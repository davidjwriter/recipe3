use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use lambda_runtime::{LambdaEvent};
use std::collections::HashMap;
use aws_sdk_dynamodb::types::AttributeValue;
use std::env;
use aws_config::{meta::region::RegionProviderChain, SdkConfig};
use aws_sdk_dynamodb::{config::Region, meta::PKG_VERSION, Client};
use clap::Parser;
use futures_util::StreamExt;
use rayon::iter::ParallelIterator;
use std::iter::Iterator;
use lambda_http::{service_fn, Response, Body, Error, Request, RequestExt};


#[derive(Debug)]
pub struct Opt {
    /// The AWS Region.
    pub region: Option<String>,

    /// Whether to display additional information.
    pub verbose: bool,
}


#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub status_code: u8,
    pub headers: HashMap<String, String>,
    pub body: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct URLRequest {
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct FailureResponse {
    pub body: String,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Recipe {
    pub uuid: String,
    pub name: String,
    pub ingredients: Vec<String>,
    pub instructions: Vec<String>,
    pub notes: String,
    pub summary: String,
    pub image: String,
}

impl From<&HashMap<String, AttributeValue>> for Recipe {
    fn from(value: &HashMap<String, AttributeValue>) -> Self {
        let mut recipe = Recipe {
            uuid: as_string(value.get("uuid"), &String::from("UUID")),
            name: as_string(value.get("name"), &String::from("NAME")),
            ingredients: split_string(as_string(value.get("ingredients"), &String::from("INGREDIENTS"))),
            instructions: split_string(as_string(value.get("instructions"), &String::from("INSTRUCTIONS"))),
            notes: as_string(value.get("notes"), &String::from("NOTES")),
            summary: as_string(value.get("summary"), &String::from("SUMMARY")),
            image: as_string(value.get("image"), &String::from("IMAGE")),
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

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = service_fn(handler);
    lambda_http::run(func).await?;

    Ok(())
}

pub fn make_region_provider(region: Option<String>) -> RegionProviderChain {
    RegionProviderChain::first_try(region.map(Region::new))
        .or_default_provider()
        .or_else(Region::new("us-east-1"))
}

pub async fn make_config(opt: Opt) -> Result<SdkConfig, Error> {
    let region_provider = make_region_provider(opt.region);

    println!();
    if opt.verbose {
        println!("DynamoDB client version: {}", PKG_VERSION);
        println!(
            "Region:                  {}",
            region_provider.region().await.unwrap().as_ref()
        );
        println!();
    }

    Ok(aws_config::from_env().region(region_provider).load().await)
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

async fn get_recipe_from_db(client: &Client, table_name: &str, url: &str) -> Result<Vec<Recipe>, Error> {
    let pk = AttributeValue::S(url.to_string());
    
    let response = client.get_item()
        .table_name(table_name)
        .key("uuid".to_string(), pk)
        .send().await?;
    let mut recipes = Vec::new();
    if let Some(recipe) = response.item {
        recipes.push(Recipe::from(&recipe));
        return Ok(recipes);
    } else {
        return Ok(recipes);
    }
}

async fn get_recipes_from_db(client: &Client, table_name: &str) -> Result<Vec<Recipe>, FailureResponse> {
    let tables = match client.list_tables().send().await {
        Ok(t) => t,
        Err(e) => {
            println!("Client list tables error: {}", e.to_string());
            return Err(FailureResponse {
                body: format!("Error reading from db: {:?}", e)
            });
        }
    };
    println!("Tables: {:?}", tables);
    let items = match client
        .scan()
        .table_name(table_name)
        .send()
        .await {
            Ok(i) => i,
            Err(e) => {
                return Err(FailureResponse {
                    body: format!("Err db: {:?}", e)
                });
            }
        };

    
    let recipes: Vec<Recipe> = items
        .items
        .unwrap()
        .iter()
        .map(|hashmap| Recipe::from(hashmap))
        .collect();
    return Ok(recipes);
}

async fn handler(request: Request) -> Result<Response<String>, Error> {
    // 1. Create db client and get table name from env
    let opt = Opt {
        region: Some("us-east-1".to_string()),
        verbose: true,
    };
    let config = match make_config(opt).await {
        Ok(c) => c,
        Err(e) => {
            return Ok(Response::builder()
            .status(500)
            .body(format!("Error making config: {}", e.to_string()))?);
            
        },
    };
    println!("Config: {:?}", config);
    let db_client = Client::new(&config);
    println!("DB Client: {:?}", db_client);
    let table_name = match get_table_name().await {
        Some(t) => t,
        None => {
            return Ok(Response::builder()
            .status(500)
            .body(String::from("TABLE_NAME not set"))?);
        }
    };
    println!("Table Name: {}", table_name);
    // 2. Get recipes from db

    // 2a. Check if url provided then get just that recipe, otherwise return all recipes

    let query_params = request.query_string_parameters();
    let query_params_map: HashMap<String, String> = query_params
        .iter()
        .map(|(key, value)| (key.to_string(), value.to_string()))
        .collect();

    let recipes = if let Some(url_value) = query_params_map.get("url") {
        get_recipe_from_db(&db_client, &table_name, &url_value).await?
    } else {
        get_recipes_from_db(&db_client, &table_name).await?
    };

    // 3. Return said recipes in JSON format
    let json_string = serde_json::to_string(&recipes).unwrap();
    let mut cors = HashMap::new();
    cors.insert(String::from("Access-Control-Allow-Origin"), String::from("*"));

    Ok(Response::builder()
        .status(200)
        .header("Access-Control-Allow-Origin", "*")
        .body(json_string)?)
}
