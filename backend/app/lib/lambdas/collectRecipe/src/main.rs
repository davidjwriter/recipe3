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

#[derive(Debug)]
pub struct Opt {
    /// The AWS Region.
    pub region: Option<String>,
    /// Whether to display additional information.
    pub verbose: bool,
}

#[derive(Deserialize)]
pub struct RequestBody {
    pub username: String,
    pub uuid: String
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

async fn get_table_name() -> Option<String> {
    env::var("TABLE_NAME").ok()
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
                .header("Access-Control-Allow-Origin", "*")
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
                .header("Access-Control-Allow-Origin", "*")
                .body(String::from("TABLE_NAME not set"))?);
            }
        };
        println!("Table Name: {}", table_name);

        // 2. Get request body
        let body = request.body();
        let recipe_collected: RequestBody = serde_json::from_slice(&body)?;

        // 3. Add recipe to DB
        let username = AttributeValue::S(recipe_collected.username);
        let uuid = AttributeValue::S(recipe_collected.uuid);

        let db_request = db_client
            .put_item()
            .table_name(table_name)
            .item("username", username)
            .item("uuid", uuid);

        db_request.send().await?;

        Ok(Response::builder()
            .status(200)
            .header("Access-Control-Allow-Origin", "*")
            .body(String::from("Collected!"))?)
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
    fn test_collect_recipe() {
        dotenv::from_filename("../../.env").ok();
        let body = r#"
        {
            "username": "dmbluesmith",
            "uuid": "https://tasty.co/recipe/slow-cooker-loaded-potato-soup"
        }"#;
        let req = Request::new(Body::from(body));
        println!("Request: {:?}", req);
        let res = aw!(handler(req));
        println!("Response: {:?}", res);
    }
}
