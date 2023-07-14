use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use lambda_runtime::{service_fn, LambdaEvent, Error};
use std::collections::HashMap;
use futures_util::future::join_all;
use reqwest::get;
use select::document::Document;
use select::predicate::Name;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::{Client};
use aws_config;
use uuid::Uuid;
use std::env;
use openai_api_rs::v1::api;
use openai_api_rs::v1::chat_completion::{self, ChatCompletionRequest};
use scraper::{Html, Selector};



const PROMPT: &str = "Using this web page content, parse the recipe out and put it in JSON format using this format: {name: <str>, ingredients: [], instructions: [], notes: <str>}";

#[derive(Deserialize)]
pub struct Request {
    pub _body: String,
}

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

type Response = Result<SuccessResponse, FailureResponse>;

#[tokio::main]
async fn main() -> Result<(), lambda_runtime::Error> {
    let func = service_fn(handler);
    lambda_runtime::run(func).await?;

    Ok(())
}

async fn get_web_contents(url: &str) -> Response {
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

    // Extract the recipe title
    let recipe_title = document
        .select(&recipe_title_selector)
        .next()
        .map(|element| element.text().collect::<String>())
        .unwrap_or_else(|| "Recipe title not found".to_owned());

    println!("Recipe Title: {}", recipe_title);

    println!("Recipe Contents:");
    let mut recipe_content_list = Vec::new();
    for recipe_content in document.select(&recipe_page) {
        println!("{}", recipe_content.text().collect::<String>());
        recipe_content_list.push(recipe_content.text().collect::<String>());
    }

    for recipe_content in document.select(&mariyum_recipe_content) {
        println!("{}", recipe_content.text().collect::<String>());
        recipe_content_list.push(recipe_content.text().collect::<String>());
    }

    let recipe = format!("{} {}", recipe_title, recipe_content_list.join(""));

    return Ok(SuccessResponse {
        body: recipe
    });
}

async fn get_api_key() -> Option<String> {
    env::var("OPEN_AI_API_KEY").ok()
}

async fn get_table_name() -> Option<String> {
    env::var("TABLE_NAME").ok()
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
pub async fn add_to_db(client: &Client, recipe: Recipe, table: &String) -> Result<String, Error> {
    let uuid = AttributeValue::S(generate_uuid().await);
    let name = AttributeValue::S(recipe.name);
    let ingredients = AttributeValue::S(join_strings(recipe.ingredients).await);
    let instructions = AttributeValue::S(join_strings(recipe.instructions).await);
    let notes = AttributeValue::S(recipe.notes);

    let request = client
        .put_item()
        .table_name(table)
        .item("uuid", uuid)
        .item("name", name)
        .item("ingredients", ingredients)
        .item("instructions", instructions)
        .item("notes", notes);

    println!("Executing request [{request:?}] to add item...");

    request.send().await?;

    Ok(String::from("Recipe Added!"))
}



async fn handler(event: LambdaEvent<Value>) -> Response {
    // 1. Get URL passed in
    let url_value: Value = event.payload;
    println!("URL: {}", url_value);

    let url = match url_value.get("body") {
        Some(u) => u,
        None => {
            println!("Error: {:?}", url_value);
            return Err(FailureResponse {
                body: format!("URL Parse Error")
            });
        }
    };

    let json_url = match serde_json::from_str::<Value>(url.as_str().unwrap()) {
        Ok(value) => value["url"].as_str().unwrap().to_owned(),
        Err(e) => {
            println!("Error parsing json: {:?}", e);
            return Err(FailureResponse {
                body: format!("Error parsing json: {:?}", e)
            });
        }
    };

    // 2. Get web contents
    let contents = get_web_contents(&json_url).await?;

    // 3. Parse recipe from web contents
    let recipe = match parse_recipe(contents.body).await {
        Ok(r) => r,
        Err(e) => return Err(e),
    };

    // 4. Add recipe to db
    let config = aws_config::load_from_env().await;
    let db_client = Client::new(&config);
    let table_name = match get_table_name().await {
        Some(t) => t,
        None => {
            return Err(FailureResponse {
                body: String::from("TABLE_NAME not set")
            });
        }
    };
    match add_to_db(&db_client, recipe, &table_name).await {
        Ok(_) => {
            return Ok(SuccessResponse {
                body: String::from("Success!"),
            });
        },
        Err(e) => {
            return Err(FailureResponse {
                body: format!("Failed! {}", e.to_string()),
            });
        }
    };
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

}
