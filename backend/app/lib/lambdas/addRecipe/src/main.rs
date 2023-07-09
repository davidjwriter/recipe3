use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use lambda_runtime::{service_fn, LambdaEvent, Error};
use std::collections::HashMap;
use futures_util::future::join_all;
use reqwest::get;
use select::document::Document;
use select::predicate::Text;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::{Client};
use aws_config;
use uuid::Uuid;
use std::env;
use openai_api_rs::v1::api;
use openai_api_rs::v1::chat_completion::{self, ChatCompletionRequest};


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
            return Err(FailureResponse {
                body: format!("Error reading URL: {}", e.to_string())
            });
        }
    };

    // Read the response body as text
    let body = match response.text().await {
        Ok(b) => b,
        Err(e) => {
            return Err(FailureResponse {
                body: format!("Error reading URL contents: {}", e.to_string())
            });
        }
    };

    // Use the select library to extract text content from the HTML
    let document = Document::from(body.as_str());

    let mut content = String::new();

    // Extract text content from all text-based HTML elements
    for node in document.find(Text) {
        let text = node.text();
        content.push_str(&text);
        content.push('\n');
    }

    Ok(SuccessResponse {
        body: content,
    })
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
                content: Some(PROMPT.to_string()),
                name: None,
                function_call: None,
            }],
            functions: None,
            function_call: None
        };
        let result = match client.chat_completion(req).await {
            Ok(r) => r,
            Err(e) => {
                return Err(FailureResponse {
                    body: format!("Error getting response from OpenAI: {}", e.to_string())
                });
            }
        };
        println!("{:?}", result.choices[0].message.content);
        let generated_content = match &result.choices[0].message.content {
            Some(c) => c,
            None => {
                return Err(FailureResponse {
                    body: format!("Could not get message content")
                })
            },
        };
        let recipe: Recipe = match serde_json::from_str(&generated_content) {
            Ok(r) => r,
            Err(e) => return Err(FailureResponse {
                body: format!("Error parsing JSON {}", e.to_string())
            }),
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

    let resp = request.send().await?;

    let attributes = resp.attributes().unwrap();

    let uuid = attributes.get("uuid").cloned();
    let name = attributes.get("name").cloned();
    let ingredients = attributes.get("ingredients").cloned();
    let instructions = attributes.get("instructions").cloned();
    let notes = attributes.get("notes").cloned();

    println!(
        "Added recipe {:?}, {:?}, {:?}, {:?}, {:?}",
        uuid, name, ingredients, instructions, notes
    );

    Ok(format!(
        "Added recipe {:?}, {:?}, {:?}, {:?}, {:?}",
        uuid, name, ingredients, instructions, notes
    ))
}



async fn handler(event: LambdaEvent<Value>) -> Response {
    // 1. Get URL passed in
    let url = match event.payload["url"].as_str() {
        Some(u) => u,
        None => {
            return Err(FailureResponse {
                body: format!("No URL Given")
            });
        }
    };

    // 2. Get web contents
    let contents = get_web_contents(url).await?;

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
