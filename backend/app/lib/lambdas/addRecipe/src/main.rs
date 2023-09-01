use serde::Deserialize;
use serde::Serialize;
use serde_json::Value;
use lambda_runtime::{LambdaEvent};
use std::collections::HashMap;
use aws_sdk_dynamodb::types::{AttributeValue};
use aws_sdk_dynamodb::operation::get_item::GetItemInput;
use std::env;
use aws_config::{meta::region::RegionProviderChain, SdkConfig};
use aws_sdk_dynamodb::{config::Region, meta::PKG_VERSION};
use aws_sdk_dynamodb::Client as DbClient;
use aws_sdk_sns::Client as SnsClient;
use futures_util::StreamExt;
use rayon::iter::ParallelIterator;
use std::iter::Iterator;
use uuid::Uuid;
use lambda_http::{service_fn, Response, Body, Error, Request};
use serde_json::json;
use aws_sdk_sqs::Client as SqsClient;


#[derive(Debug)]
pub struct Opt {
    /// The AWS Region.
    pub region: Option<String>,
    /// Whether to display additional information.
    pub verbose: bool,
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub enum ContentType {
    URL,
    IMAGE,
    BULK
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct URLRequest {
    pub url: String,
    pub content_type: ContentType,
    pub credit: Option<String>,
    pub uuid: Option<String>
}

#[derive(Serialize, Deserialize, Debug, PartialEq)]
pub struct WorkerRequest {
    pub url: String,
    pub content_type: ContentType,
    pub credit: Option<String>,
    pub uuid: Option<String>,
    pub sqs_url: String
}

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub status_code: u8,
    pub headers: HashMap<String, String>,
    pub body: String,
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
            image: as_string(value.get("image"), &String::from("IMAGE"))
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

async fn get_sns_arn() -> Option<String> {
    env::var("SNS_ARN").ok()
}

async fn get_recipe_from_db(client: &DbClient, table_name: &str, url: &str) -> Result<Option<Recipe>, Error> {
    let pk = AttributeValue::S(url.to_string());
    
    let response = client.get_item()
        .table_name(table_name)
        .key("uuid".to_string(), pk)
        .send().await?;

    if let Some(recipe) = response.item {
        return Ok(Some(Recipe::from(&recipe)));
    } else {
        return Ok(None);
    }
}

async fn generate_uuid() -> String {
    Uuid::new_v4().to_string()
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
    let table_name = match get_table_name().await {
        Some(t) => t,
        None => {
            return Ok(Response::builder()
            .status(500)
            .body(String::from("TABLE_NAME not set"))?);
        }
    };
    println!("Table Name: {}", table_name);
    // 2. Get URL from request
    let body = request.body();
    let url: URLRequest = serde_json::from_slice(&body)?;
    let url_value = &url.url;
    println!("URL: {}", url_value);

    let pk = match url.content_type {
        ContentType::URL => url_value.to_string(),
        _ => url.uuid.as_ref().unwrap().clone(),
    };

    let result = get_recipe_from_db(&db_client, &table_name, &pk).await?;

    if let Some(recipe) = result {
        println!("Found recipe");
        let json_string = serde_json::to_string(&recipe).unwrap();
        Ok(Response::builder()
            .status(200)
            .header("Access-Control-Allow-Origin", "*")
            .body(json_string)?)
    } else {
        // 4. Publish to SNS
        let sns_arn = match get_sns_arn().await {
            Some(t) => t,
            None => {
                return Ok(Response::builder()
                    .status(500)
                    .body(String::from("SNS_ARN not set"))?);
            }
        };
        println!("SNS ARN: {:?}", sns_arn);
        let sns_client = SnsClient::new(&config);
        let sqs_client = SqsClient::new(&config);

        let sqs_url_response = sqs_client
            .create_queue()
            .queue_name(generate_uuid().await)
            .send().await.unwrap();
        let sqs_url = sqs_url_response.queue_url().unwrap();
        let sqs_request = WorkerRequest {
            url: url.url,
            content_type: url.content_type,
            credit: url.credit,
            uuid: url.uuid,
            sqs_url: sqs_url.to_string()
        };
        let message = serde_json::to_string(&sqs_request).unwrap();
        let response = json!({
            "sqs_url": sqs_url
        });
        let response = serde_json::to_string(&response).unwrap();
        println!("Message: {}", message);
        match sns_client
            .publish()
            .topic_arn(sns_arn)
            .message(message)
            .send()
            .await {
                Ok(s) => {
                    println!("SNS Publish Success! {:?}", s);
                    return Ok(Response::builder()
                        .status(201)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(response)?);
                },
                Err(e) => {
                    println!("SNS Publish Failure: {:?}", e);
                    return Ok(Response::builder()
                        .status(500)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(format!("SNS Publish Failure: {:?}", e))?);
                }
            };
    }
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
    fn test_body() {
        let body = r#"
        {
            "url": "batman.com",
            "content_type": "IMAGE"
        }"#;
        let url: URLRequest = serde_json::from_slice(body.as_bytes()).expect("Problem getting url");
        let expected = URLRequest {
            url: String::from("batman.com"),
            content_type: ContentType::IMAGE
        };
        assert_eq!(url, expected);
    }
}
