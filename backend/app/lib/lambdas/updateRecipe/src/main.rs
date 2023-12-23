use std::collections::HashMap;
use serde::Deserialize;
use serde::Serialize;
use lambda_runtime::{LambdaEvent};
use aws_sdk_dynamodb::types::{AttributeValue};
use std::env;
use aws_config::{meta::region::RegionProviderChain, SdkConfig};
use aws_sdk_dynamodb::{config::Region, meta::PKG_VERSION};
use aws_sdk_dynamodb::Client as DbClient;
use lambda_http::{service_fn, Response, Body, Error, Request};
use serde_json::Value;


const NAME: &str = "name";
const INGREDIENTS: &str = "ingredients";
const INSTRUCTIONS: &str = "instructions";
const NOTES: &str = "notes";
const SUMMARY: &str = "summary";

#[derive(Debug)]
pub struct Opt {
    /// The AWS Region.
    pub region: Option<String>,
    /// Whether to display additional information.
    pub verbose: bool,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Recipe {
    pub uuid: String,
    pub name: Option<String>,
    pub ingredients: Option<Vec<String>>,
    pub instructions: Option<Vec<String>>,
    pub notes: Option<String>,
    pub summary: Option<String>,
}

#[derive(Debug)]
pub struct Expression {
    pub expression: String,
    pub names: HashMap<String, String>,
    pub values: HashMap<String, AttributeValue>
}

impl Expression {
    fn from(recipe: Recipe) -> Expression {
        let mut expressions: Vec<String> = Vec::new();
        let mut names: HashMap<String, String> = HashMap::new();
        let mut values: HashMap<String, AttributeValue> = HashMap::new();

        // Name
        if let Some(name) = &recipe.name {
            expressions.push(String::from("#name = :nameValue"));
            names.insert("#name".to_string(), NAME.to_string());
            values.insert(":nameValue".to_string(), AttributeValue::S(name.clone()));
        }

        // Ingredients
        if let Some(ingredients) = &recipe.ingredients {
            let string_ingredients = join_strings(ingredients.to_vec());
            expressions.push(String::from("#ingredients = :ingredientsValue"));
            names.insert("#ingredients".to_string(), INGREDIENTS.to_string());
            values.insert(":ingredientsValue".to_string(), AttributeValue::S(string_ingredients));
        }

        // Instructions
        if let Some(instructions) = &recipe.instructions {
            let string_instructions = join_strings(instructions.to_vec());
            expressions.push(String::from("#instructions = :instructionsValue"));
            names.insert("#instructions".to_string(), INSTRUCTIONS.to_string());
            values.insert(":instructionsValue".to_string(), AttributeValue::S(string_instructions));
        }

        // Notes
        if let Some(notes) = &recipe.notes {
            expressions.push(String::from("#notes = :notesValue"));
            names.insert("#notes".to_string(), NOTES.to_string());
            values.insert(":notesValue".to_string(), AttributeValue::S(notes.clone()));
        }

        // Summary
        if let Some(summary) = &recipe.summary {
            expressions.push(String::from("#summary = :summaryValue"));
            names.insert("#summary".to_string(), SUMMARY.to_string());
            values.insert(":summaryValue".to_string(), AttributeValue::S(summary.clone()));
        }

        Expression {
            expression: format!("SET {}", expressions.join(",")),
            names,
            values
        }
    }
}

pub fn make_region_provider(region: Option<String>) -> RegionProviderChain {
    RegionProviderChain::first_try(region.map(Region::new))
        .or_default_provider()
        .or_else(Region::new("us-east-1"))
}

pub async fn make_config(opt: Opt) -> Result<SdkConfig, Error> {
    let region_provider = make_region_provider(opt.region);

    Ok(aws_config::from_env().region(region_provider).load().await)
}

fn join_strings(strings: Vec<String>) -> String {
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

fn split_string(string: String) -> Vec<String> {
    let escaped_strings: Vec<String> = string
        .split(";")
        .map(|substring| substring.replace("\\;", ";").replace("\\,", ",").replace("\\\\", "\\"))
        .collect();

    escaped_strings
}

pub async fn update_db(client: &DbClient, recipe: Recipe, table: &String) -> Result<String, Error> {
    let uuid = AttributeValue::S(recipe.uuid.clone());
    let expression = Expression::from(recipe);
    println!("Expression: {:?}", expression.expression);
    let request = client
        .update_item()
        .table_name(table)
        .key("uuid".to_string(), uuid)
        .update_expression(expression.expression)
        .set_expression_attribute_names(Some(expression.names))
        .set_expression_attribute_values(Some(expression.values));

    request.send().await?;

    Ok(String::from("Recipe Updated!"))
}

async fn get_table_name() -> Option<String> {
    env::var("TABLE_NAME").ok()
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = service_fn(handler);
    lambda_http::run(func).await?;

    Ok(())
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
            .status(400)
            .body(format!("Error making config: {}", e.to_string()))?);
            
        },
    };
    let db_client = DbClient::new(&config);
    let table_name = match get_table_name().await {
        Some(t) => t,
        None => {
            return Ok(Response::builder()
            .status(400)
            .body(String::from("TABLE_NAME not set"))?);
        }
    };
    println!("Table Name: {}", table_name);

    let body = request.body();
    let recipe: Recipe = serde_json::from_slice(&body)?;

    match update_db(&db_client, recipe, &table_name).await {
        Ok(_) => {
            return Ok(Response::builder()
                .status(200)
                .body(String::from("DB Updated!"))?);
        },
        Err(e) => {
            return Ok(Response::builder()
                .status(400)
                .body(format!("DB Failed to Update! {:?}", e))?);
        }
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
    fn test_update() {
        dotenv::from_filename("../../.env").ok();
        let body = r#"
        {
            "uuid": "https://tasty.co/recipe/taco-soup",
            "name": "Taco Soup",
            "instructions": [
                "First, make tacos",
                "Now, eat them"
            ]
        }"#;
        let req = Request::new(Body::from(body));
        let res = aw!(handler(req));
        println!("Response: {:?}", res);
        assert_eq!(res.unwrap().status().as_u16(), 200);
    }
}
