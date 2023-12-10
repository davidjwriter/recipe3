use serde::Deserialize;
use serde::Serialize;
use serde_json::{json, Value};
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client as DbClient;
use std::env;
use lambda_http::{Response, Body, Error, Request};
use lambda_runtime::{service_fn, LambdaEvent};
use dotenv::dotenv;
use aws_config::{meta::region::RegionProviderChain, SdkConfig};
use aws_sdk_dynamodb::{config::Region, meta::PKG_VERSION};
use std::collections::HashMap;
use futures::future::try_join_all;

#[derive(Debug)]
pub struct Opt {
    /// The AWS Region.
    pub region: Option<String>,
    /// Whether to display additional information.
    pub verbose: bool,
}

#[derive(Deserialize)]
pub struct RequestBody {
    pub username: String
}

#[derive(Serialize)]
pub struct RecipeMetaData {
    pub username: String,
    pub uuid: String
}

impl From<&HashMap<String, AttributeValue>> for RecipeMetaData {
    fn from(value: &HashMap<String, AttributeValue>) -> Self {
        let mut recipe = RecipeMetaData {
            username: as_string(value.get("username"), &String::from("USERNAME")),
            uuid: as_string(value.get("uuid"), &String::from("UUID"))
        };
        recipe
    }
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
            image: as_string(value.get("image"), &String::from("IMAGE"))
        };
        recipe
    }
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

async fn get_user_table_name() -> Option<String> {
    env::var("USER_TABLE_NAME").ok()
}

async fn get_recipe_table_name() -> Option<String> {
    env::var("RECIPE_TABLE_NAME").ok()
}

async fn get_recipe_from_db(client: &DbClient, table_name: &String, r: RecipeMetaData) -> Result<Recipe, Error> {
    let pk = AttributeValue::S(r.uuid);

    let response = client.get_item()
        .table_name(table_name)
        .key("uuid".to_string(), pk)
        .send()
        .await?;

    if let Some(recipe) = response.item {
        return Ok(Recipe::from(&recipe));
    } else {
        return Err(Error::from("Error getting item"));
    }
}

async fn fetch_recipes(client: &DbClient, table_name: &String, recipe_meta_data_vec: Vec<RecipeMetaData>) -> Result<Vec<Recipe>, Error> {
    let futures = recipe_meta_data_vec
        .into_iter()
        .map(|meta_data| get_recipe_from_db(client, table_name, meta_data));

    // Use try_join_all to asynchronously collect the results
    let results: Result<Vec<Recipe>, Error> = try_join_all(futures).await;

    results
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
        let db_client = DbClient::new(&config);
        println!("DB Client: {:?}", db_client);

        let user_table_name = match get_user_table_name().await {
            Some(t) => t,
            None => {
                return Ok(Response::builder()
                .status(500)
                .body(String::from("TABLE_NAME not set"))?);
            }
        };

        let recipe_table_name = match get_recipe_table_name().await {
            Some(t) => t,
            None => {
                return Ok(Response::builder()
                .status(500)
                .body(String::from("TABLE_NAME not set"))?);
            }
        };

        // 2. Get request body
        let body = request.body();
        let user: RequestBody = serde_json::from_slice(&body)?;

        // 3. Get user's recipes
        let user_recipes = db_client
            .query()
            .table_name(user_table_name)
            .key_condition_expression("#un = :username")
            .expression_attribute_names("#un", "username")
            .expression_attribute_values(":username", AttributeValue::N(user.username))
            .send()
            .await?;

        // 4. For each recipe uuid, get the recipe
        if let Some(items) = user_recipes.items {
            let recipe_meta_data: Vec<RecipeMetaData> = items.iter().map(|item| {
                RecipeMetaData::from(item)
            }).collect();

            let recipes = match fetch_recipes(&db_client, &recipe_table_name, recipe_meta_data).await {
                Ok(r) => r,
                Err(e) => {
                    return Ok(Response::builder()
                        .status(500)
                        .body(format!("Error fetching recipes: {}", e))?);
                }
            };

            let json_string = serde_json::to_string(&recipes).unwrap();
            Ok(Response::builder()
                .status(200)
                .header("Access-Control-Allow-Origin", "*")
                .body(json_string)?)        
        } else {
            return Ok(Response::builder()
                .status(200)
                .body(String::from("No recipes found for user"))?);
        }
}
