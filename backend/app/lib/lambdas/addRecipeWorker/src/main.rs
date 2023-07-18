use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use futures_util::future::join_all;
use reqwest::get;
use select::document::Document;
use select::predicate::Name;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::{Client};
use aws_lambda_events::event::sns;
use aws_config;
use uuid::Uuid;
use std::env;
use openai_api_rs::v1::api;
use openai_api_rs::v1::chat_completion::{self, ChatCompletionRequest};
use openai_api_rs::v1::image::ImageGenerationRequest;
use openai_api_rs::v1::error::APIError;
use scraper::{Html, Selector};
use lambda_http::{Response, Body, Error, Request};
use lambda_runtime::{service_fn, LambdaEvent};
use tokio::fs::File;
use reqwest::{multipart};
use tokio_util::codec::{BytesCodec, FramedRead};
use std::path::Path;
use std::io::prelude::*;
use base64;
use tokio::io::AsyncWriteExt;
use dotenv::dotenv;
use std::any::Any;


const PROMPT: &str = "Using this web page content, parse the recipe out, summarize it, and put it in JSON format using this format: {name: <str>, ingredients: [], instructions: [], notes: <str>, summary: <str>}";

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub body: String,
}

#[derive(Debug, Serialize)]
pub struct FailureResponse {
    pub body: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Recipe {
    pub name: String,
    pub ingredients: Vec<String>,
    pub instructions: Vec<String>,
    pub notes: String,
    pub summary: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct URLRequest {
    pub url: String,
}

// Implement Display for the Failure response so that we can then implement Error.
impl std::fmt::Display for FailureResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.body)
    }
}

// Implement Error for the FailureResponse so that we can `?` (try) the Response
// returned by `lambda_runtime::run(func).await` in `fn main`.
impl std::error::Error for FailureResponse {}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = service_fn(handler);
    lambda_runtime::run(func).await?;

    Ok(())
}

async fn get_web_contents(url: &str) -> Result<SuccessResponse, FailureResponse> {
    // Send a GET request to the URL
    let response = match get(url).await {
        Ok(r) => r,
        Err(e) => {
            println!("Error reading URL: {:?} {:?}", url, e);
            return Err(FailureResponse {
                body: format!("Error reading URL: {}", e)
            });
        }
    };

    // Read the response body as text
    let body = match response.text().await {
        Ok(b) => b,
        Err(e) => {
            println!("Error reading URL contents: {:?}", e);
            return Err(FailureResponse {
                body: format!("Error reading URL contents: {}", e)
            });
        }
    };
    let document = Html::parse_document(&body);

    // Use CSS selectors to identify the recipe elements
    let recipe_title_selector = Selector::parse("h1").unwrap();
    let ingredient_selector = Selector::parse(".recipe-ingredient").unwrap();
    let instruction_selector = Selector::parse(".recipe-instruction").unwrap();
    let recipe_page = Selector::parse(".recipe-content").unwrap();
    let mariyum_recipe_content = Selector::parse(".wprm-recipe-container").unwrap();
    let meta_data_selector = Selector::parse("script[type=\"application/ld+json\"]").expect("Failed to parse selector");


    // Extract the recipe title
    let recipe_title = document
        .select(&recipe_title_selector)
        .next()
        .map(|element| element.text().collect::<String>())
        .unwrap_or_else(|| "Recipe title not found".to_owned());

    println!("Recipe Title: {}", recipe_title);

    println!("Recipe Contents:");
    let mut recipe_content_list = Vec::new();
    // for recipe_content in document.select(&recipe_page) {
    //     println!("{}", recipe_content.text().collect::<String>());
    //     recipe_content_list.push(recipe_content.text().collect::<String>());
    // }

    // for recipe_content in document.select(&mariyum_recipe_content) {
    //     println!("{}", recipe_content.text().collect::<String>());
    //     recipe_content_list.push(recipe_content.text().collect::<String>());
    // }
    println!("Recipe Metadata: ");
    for recipe_content in document.select(&meta_data_selector) {
        recipe_content_list.push(recipe_content.text().collect::<String>());
    }

    let mut recipe = format!("{} {}", recipe_title, recipe_content_list.join(""));
    recipe = recipe.replace('\n', " ");
    let words: Vec<&str> = recipe.split_whitespace().take(800).collect();

    return Ok(SuccessResponse {
        body: words.join("")
    });
}

async fn get_api_key() -> Option<String> {
    env::var("OPEN_AI_API_KEY").ok()
}

async fn get_table_name() -> Option<String> {
    env::var("TABLE_NAME").ok()
}

async fn generate_recipe_image(summary: &String, title: &String) -> Result<String, FailureResponse> {
    let open_ai_api_key = get_api_key().await;
    if let Some(api_key) = open_ai_api_key {
        let client = api::Client::new(api_key);
        let req = ImageGenerationRequest {
            prompt: summary.clone(),
            n: None,
            size: None,
            response_format: None,
            user: None,
        };
        println!("Image gen request: {:?}", req);
        let mut result = match client.image_generation(req).await {
            Ok(r) => r,
            Err(err) => {
                println!("Error with OpenAI, trying with Title: {:?}", err);
                let req = ImageGenerationRequest {
                    prompt: format!("A realistic photo of {}", title.clone()),
                    n: None,
                    size: None,
                    response_format: None,
                    user: None,
                };
                match client.image_generation(req).await {
                    Ok(r) => r,
                    Err(e) => {
                        println!("Error with OpenAI: {:?}", e);
                        return Err(FailureResponse {
                            body: format!("Error getting response from OpenAI: {:?}", e),
                        });
                    }
                }
            }
        };        
        println!("Result: {:?}", result);

        let url = result.data[0].url.clone();

        let response = reqwest::get(url)
            .await
            .expect("Failed to send request");

        // Read the response body as bytes
        let image_bytes = response
            .bytes()
            .await
            .expect("Failed to read response body");

        // Encode the image bytes as base64
        let base64_encoded = base64::encode(&image_bytes);
        return Ok(base64_encoded);
    }
    return Err(FailureResponse {
        body: String::from("API Key Not Set")
    });
}

async fn upload_to_arweave(image: String) -> Result<String, Error> {
    let decoded_image = base64::decode(image).unwrap();

    let mut file = File::create("/tmp/image.jpg").await.unwrap(); // Specify the desired file path and extension here
    file.write_all(&decoded_image).await.unwrap();
    let f = File::open("/tmp/image.jpg").await.expect("Problem opening file");
    // Step 2: Prepare and send the HTTP request with the file
    let client = reqwest::Client::new();
    let uri = "http://arweaveservice-env.eba-jbui8icp.us-east-1.elasticbeanstalk.com/upload";

    // Get file stream setup
    let stream = FramedRead::new(f, BytesCodec::new());
    let file_body = reqwest::Body::wrap_stream(stream);

    let form_part = multipart::Part::stream(file_body)
        .file_name("/tmp/image.jpg".to_string())
        .mime_str("image/jpeg")
        .expect("Problem creating image part");

    let form = multipart::Form::new().part("book", form_part);

    let response = client
        .post(uri)
        .multipart(form)
        .send();

    let image_url_resp = response
        .await
        .expect("Problem Getting Image Response");
    let image_url = image_url_resp
        .text()
        .await
        .expect("Problem Parsing Image Response");

    Ok(image_url)
}

async fn parse_recipe(contents: String) -> Result<Recipe, FailureResponse> {
    let open_ai_api_key = get_api_key().await;
    if let Some(api_key) = open_ai_api_key {
        let client = api::Client::new(api_key);
        let req = ChatCompletionRequest {
            model: chat_completion::GPT4.to_string(),
            messages: vec![chat_completion::ChatCompletionMessage {
                role: chat_completion::MessageRole::user,
                content: Some(format!("{} {}", PROMPT.to_string(), contents)),
                name: None,
                function_call: None,
            }],
            functions: None,
            function_call: None
        };
        println!("Chat Request: {:?}", req);
        let result = match client.chat_completion(req).await {
            Ok(r) => r,
            Err(e) => {
                println!("Error with OpenAI: {:?}", e);
                return Err(FailureResponse {
                    body: format!("Error getting response from OpenAI: {:?}", e)
                });
            }
        };
        println!("{:?}", result.choices[0].message.content);
        let generated_content = match &result.choices[0].message.content {
            Some(c) => c,
            None => {
                println!("Could not get message content");
                return Err(FailureResponse {
                    body: format!("Could not get message content")
                })
            },
        };
        let recipe: Recipe = match serde_json::from_str(&generated_content) {
            Ok(r) => r,
            Err(e) => {
                println!("Error parsing JSON {:?}", e);
                return Err(FailureResponse {
                    body: format!("Error parsing JSON {:?}", e)
                });
            }
        };
        return Ok(recipe);
    }
    return Err(FailureResponse {
        body: String::from("API Key Not Set")
    });
}

async fn join_strings(strings: Vec<String>) -> String {
    strings
        .iter()
        .map(|string| {
            let escaped_string = string
                .replace("\\", "\\\\") // Escape backslashes
                .replace(",", "\\,") // Escape commas
                .replace(";", "\\;"); // Escape semicolons
            escaped_string
        })
        .collect::<Vec<String>>()
        .join(";")
}

async fn split_string(string: String) -> Vec<String> {
    let escaped_strings: Vec<String> = string
        .split(";")
        .map(|substring| substring.replace("\\;", ";").replace("\\,", ",").replace("\\\\", "\\"))
        .collect();

    escaped_strings
}

async fn generate_uuid() -> String {
    Uuid::new_v4().to_string()
}


/**
 * Data format:
 * primary_key: uuid
 * name: string
 * ingredients: []
 * instructions: []
 * notes: string
 */
pub async fn add_to_db(client: &Client, recipe: Recipe, url: &str, image_url: &str, table: &String) -> Result<String, Error> {
    let uuid = AttributeValue::S(url.to_string());
    let name = AttributeValue::S(recipe.name);
    let ingredients = AttributeValue::S(join_strings(recipe.ingredients).await);
    let instructions = AttributeValue::S(join_strings(recipe.instructions).await);
    let notes = AttributeValue::S(recipe.notes);
    let summary = AttributeValue::S(recipe.summary);
    let image = AttributeValue::S(image_url.to_string());

    let request = client
        .put_item()
        .table_name(table)
        .item("uuid", uuid)
        .item("name", name)
        .item("ingredients", ingredients)
        .item("instructions", instructions)
        .item("notes", notes)
        .item("summary", summary)
        .item("image", image);

    println!("Executing request [{request:?}] to add item...");

    request.send().await?;

    Ok(String::from("Recipe Added!"))
}

async fn worker(body: &str) -> Result<String, Error> {
    let url: URLRequest = match serde_json::from_str(&body) {
        Ok(u) => u,
        Err(e) => {
            println!("Error matching URL: {:?}", e);
            return Ok(format!("Error matching URL: {:?}", e));
        }
    };
    let url_value = url.url;
    println!("URL: {}", url_value);

    // 2. Get web contents
    let contents = get_web_contents(&url_value).await?;

    // 3. Parse recipe from web contents
    let recipe = match parse_recipe(contents.body).await {
        Ok(r) => r,
        Err(e) => {
            return Ok(format!("Error parsing recipe: {:?}", e));
        },
    };

    // 4. Generate recipe image
    let image_url = match generate_recipe_image(&recipe.summary, &recipe.name).await {
        Ok(url) => match upload_to_arweave(url).await {
            Ok(u) => u,
            Err(e) => {
                println!("Error uploading to arweave: {:?}", e);
                String::from("https://arweave.net/imiGGOP3GIoPcVUJAoZIaBI7DqQRZ7nPSiqunzMIMxQ")    
            }
        },
        Err(e) => {
            println!("Error generating image: {:?}", e);
            String::from("https://arweave.net/imiGGOP3GIoPcVUJAoZIaBI7DqQRZ7nPSiqunzMIMxQ")
        }
    };

    // 5. Add recipe to db
    let config = aws_config::load_from_env().await;
    let db_client = Client::new(&config);
    let table_name = match get_table_name().await {
        Some(t) => t,
        None => {
            return Ok(String::from("Table Name Not Set"));
        }
    };
    match add_to_db(&db_client, recipe, &url_value, &image_url, &table_name).await {
        Ok(_) => {
            return Ok(String::from("Success!"));
        },
        Err(e) => {
            return Ok(format!("Failed! {:?}", e));
        }
    };
}


async fn handler(event: LambdaEvent<sns::SnsEvent>) -> Result<String, Error> {
    // 1. Get SNS event records
    let records = event.payload.records;

    // 2. iterate through records and call worker function
    for record in records {
        worker(&record.sns.message).await?;
    }

    Ok("Success!".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    macro_rules! aw {
        ($e:expr) => {
            tokio_test::block_on($e)
        };
    }

    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }

    #[test]
    fn get_document_tasty() {
        let url = "https://tasty.co/recipe/garlic-bacon-shrimp-alfredo";

        let response = aw!(get_web_contents(url));
        println!("Response: {:?}", response);
    }

    #[test]
    fn get_document_mariyum() {
        let url = "https://mxriyum.com/lobster-mac-cheese/";

        let response = aw!(get_web_contents(url));
        println!("Response: {:?}", response);
    }

    #[test]
    fn get_web_doc_allrecipe() {
        let url = "https://www.allrecipes.com/recipe/12578/cinnamon-pie/";

        let response = aw!(get_web_contents(url));
        println!("Response: {:?}", response);
    }
    #[test]
    fn test_generate_image() {
        dotenv::from_filename("../../.env").ok();
        println!("Testing Image Generation!");
        let content = String::from("These Cinnamon Rolls with Cream Cheese Frosting are a delicious treat made with a soft and fluffy dough rolled with a sweet and aromatic filling. The dough is prepared using a yeast mixture and a combination of sugar, eggs, flour, salt, and melted butter. The filling is made with butter, brown sugar, cinnamon, cloves, and nutmeg. The cream cheese frosting adds a creamy and tangy element to the rolls. Enjoy these homemade cinnamon rolls fresh from the oven with a delectable cream cheese frosting!");
        let title = String::from("Cinnamon Rolls");
        let response = aw!(generate_recipe_image(&content, &title));
        let arweave_url = aw!(upload_to_arweave(response.unwrap()));
        println!("Arweave URL: {:?}", arweave_url);
    }

    // #[test]
    // fn test_upload_to_arweave() {
    //     let url = "https://oaidalleapiprodscus.blob.core.windows.net/private/org-VERV8d0sIdNA5FSba95AQTBS/user-NUbAdDtCASZStcVnHe697b0w/img-xO4fIyAwWh4kYwtZsOozx8o9.png?st=2023-07-18T19%3A56%3A42Z&se=2023-07-18T21%3A56%3A42Z&sp=r&sv=2021-08-06&sr=b&rscd=inline&rsct=image/png&skoid=6aaadede-4fb3-4698-a8f6-684d7786b067&sktid=a48cca56-e6da-484e-a814-9c849652bcb3&skt=2023-07-17T23%3A58%3A30Z&ske=2023-07-18T23%3A58%3A30Z&sks=b&skv=2021-08-06&sig=np5OEfjPFOZKKUwkamSUsGnp%2BcsiQiHh8mRSAGcZj/A%3D";
    //     let response = aw!(reqwest::get(url)).expect("Failed to send request");

    //     // Read the response body as bytes
    //     let image_bytes = aw!(response
    //         .bytes()).expect("failed");

    //     // Encode the image bytes as base64
    //     let base64_encoded = base64::encode(&image_bytes);
    //     let arweave_url = aw!(upload_to_arweave(base64_encoded));
    //     println!("Arweave URL: {:?}", arweave_url);
    // }

}
