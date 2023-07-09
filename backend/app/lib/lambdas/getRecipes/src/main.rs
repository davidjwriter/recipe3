use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use lambda_runtime::{service_fn, LambdaEvent, Error};
use std::collections::HashMap;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::{Client};
use std::env;

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

impl From<&HashMap<String, AttributeValue>> for Recipe {
    fn from(value: &HashMap<String, AttributeValue>) -> Self {
        let mut recipe = Recipe {
            name: as_string(value.get("name"), &String::from("NAME")),
            ingredients: split_string(as_string(value.get("ingredients"), &String::from("INGREDIENTS"))),
            instructions: split_string(as_string(value.get("instructions"), &String::from("INSTRUCTIONS"))),
            notes: as_string(value.get("notes"), &String::from("NOTES"))
        };
        recipe
    }
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

fn as_string(val: Option<&AttributeValue>, default: &String) -> String {
    if let Some(v) = val {
        if let Ok(s) = v.as_s() {
            return s.to_owned();
        }
    }
    default.to_owned()
}

fn split_string(string: String) -> Vec<String> {
    let escaped_strings: Vec<String> = string
        .split(";")
        .map(|substring| substring.replace("\\;", ";").replace("\\,", ",").replace("\\\\", "\\"))
        .collect();

    escaped_strings
}

async fn get_table_name() -> Option<String> {
    env::var("TABLE_NAME").ok()
}

async fn get_recipes_from_db(client: &Client, table_name: &str) -> Result<Vec<Recipe>, FailureResponse> {
    let results = match client.query().table_name(table_name).send().await {
        Ok(r) => r,
        Err(e) => {
            return Err(FailureResponse {
                body: format!("Error reading from db: {}", e.to_string())
            });
        }
    };

    if let Some(items) = results.items {
        let recipes = items.iter().map(|v| v.into()).collect();
        return Ok(recipes);
    } 
    return Err(FailureResponse {
        body: String::from("Error in getting recipes from db")
    });
}

async fn handler(_event: LambdaEvent<Value>) -> Response {
    // 1. Create db client and get table name from env
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
    // 2. Get recipes from db
    let recipes = match get_recipes_from_db(&db_client, &table_name).await {
        Ok(r) => r,
        Err(e) => {
            return Err(FailureResponse {
                body: format!("Error retrieving recipes from db: {}", e.to_string())
            });
        }
    };

    // 3. Return said recipes in JSON format
    let json_string = serde_json::to_string(&recipes).unwrap();


    Ok(SuccessResponse {
        body: json_string,
    })
}
