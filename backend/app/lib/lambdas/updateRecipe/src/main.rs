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
const OWNER: &str = "owner";

#[derive(Debug)]
pub struct Opt {
    /// The AWS Region.
    pub region: Option<String>,
    /// Whether to display additional information.
    pub verbose: bool,
}

#[derive(Deserialize, Debug)]
pub struct UpdateRequest {
    owner: String,
    updated_recipe: Recipe
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Recipe {
    pub uuid: String,
    pub name: Option<String>,
    pub ingredients: Option<Vec<String>>,
    pub instructions: Option<Vec<String>>,
    pub notes: Option<String>,
    pub summary: Option<String>,
    pub owner: Option<String>
}

#[derive(Debug)]
pub struct Expression {
    pub expression: String,
    pub condition: String,
    pub names: HashMap<String, String>,
    pub values: HashMap<String, AttributeValue>
}

impl Expression {
    fn from(req: UpdateRequest) -> Expression {
        let recipe: Recipe = req.updated_recipe;
        let mut expressions: Vec<String> = Vec::new();
        let mut names: HashMap<String, String> = HashMap::new();
        let mut values: HashMap<String, AttributeValue> = HashMap::new();

        // Create Condition
        let condition = "attribute_exists(#owner) AND #owner = :currentOwner".to_string();
        values.insert(":currentOwner".to_string(), AttributeValue::S(req.owner.clone()));
        names.insert("#owner".to_string(), OWNER.to_string());

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

        if let Some(owner) = &recipe.owner {
            expressions.push(String::from("#owner = :ownerValue"));
            names.insert("#owner".to_string(), OWNER.to_string());
            values.insert(":ownerValue".to_string(), AttributeValue::S(owner.clone()));
        }

        Expression {
            expression: format!("SET {}", expressions.join(",")),
            condition,
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

pub async fn update_db(client: &DbClient, req: UpdateRequest, table: &String) -> Result<String, Error> {
    let uuid = AttributeValue::S(req.updated_recipe.uuid.clone());
    let expression = Expression::from(req);
    println!("Expression: {:?}", expression.expression);

    let request = client
        .update_item()
        .table_name(table)
        .key("uuid".to_string(), uuid)
        .update_expression(expression.expression)
        .set_expression_attribute_names(Some(expression.names))
        .set_expression_attribute_values(Some(expression.values))
        .set_condition_expression(Some(expression.condition));

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
    let req: UpdateRequest = serde_json::from_slice(&body)?;

    println!("Recipe: {:?}", req);

    match update_db(&db_client, req, &table_name).await {
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
            "owner": "dmbluesmith",
            "updated_recipe": {
                "uuid": "https://tasty.co/recipe/taco-soup",
                "name": "Taco Soup",
                "instructions": [
                    "First, make tacos",
                    "Now, eat them"
                ]
            }
        }"#;
        let req = Request::new(Body::from(body));
        let res = aw!(handler(req));
        println!("Response: {:?}", res);
        assert_eq!(res.unwrap().status().as_u16(), 200);
    }

    #[test]
    fn test_update_not_allow() {
        dotenv::from_filename("../../.env").ok();
        let body = r#"
        {
            "owner": "hacker",
            "updated_recipe": {
                "uuid": "https://tasty.co/recipe/taco-soup",
                "name": "Hack That Soup",
                "instructions": [
                    "First, make hacked",
                    "Now, die"
                ]
            }
        }"#;
        let req = Request::new(Body::from(body));
        let res = aw!(handler(req));
        println!("Response: {:?}", res);
        assert_eq!(res.unwrap().status().as_u16(), 400);
    }

    #[test]
    fn test_one_time_update() {
        dotenv::from_filename("../../.env").ok();
        let uuids = vec![
            "https://www.keyingredient.com/recipes/2854685032/pomegranate-habanero-beef/AMP/",
            "https://tasty.co/recipe/slow-cooker-loaded-potato-soup",
            "https://www.allrecipes.com/recipe/12578/cinnamon-pie/",
            "https://mxriyum.com/mozzarella-stuffed-rosemary-pull-apart-bread/",
            "https://www.wandercooks.com/gyoza-japanese-pork-dumplings/",
            "https://www.foodandwine.com/recipes/pumpkin-gingersnap-tiramisu",
            "https://whatgreatgrandmaate.com/asian-chili-garlic-shrimp/",
            "https://minimalistbaker.com/1-pot-apple-butter-date-sweetened/",
            "448b5102-ca04-4451-a18e-692acbeded01",
            "https://www.allrecipes.com/air-fryer-turtle-cheesecake-recipe-7511366",
            "https://tasty.co/recipe/homemade-cinnamon-rolls",
            "https://mxriyum.com/lobster-mac-cheese/",
            "https://tasty.co/recipe/one-pot-chicken-fajita-pasta",
            "https://www.keyingredient.com/recipes/2854685032/pomegranate-habanero-beef/",
            "https://tasty.co/recipe/one-pot-swedish-meatball-pasta",
            "https://tasty.co/recipe/molten-lava-brownie",
            "https://tasty.co/recipe/garlic-bacon-shrimp-alfredo",
            "ef0b8b8f-282e-45e1-ada5-8e1ac96f1fc0",
            "366919cf-eaa3-454e-8747-e8435615d719",
            "https://www.allrecipes.com/recipe/8538411/smores-cookies/",
            "https://tasty.co/recipe/taco-soup",
            "https://www.allrecipes.com/easy-cheesy-pull-apart-garlic-bread-recipe-7563489",
            "https://mxriyum.com/mini-chicken-alfredo-pizzas/",
            "https://tasty.co/recipe/the-best-chewy-chocolate-chip-cookies",
            "https://www.chilipeppermadness.com/chili-pepper-recipes/hot-sauces/ghost-pepper-hot-sauce-recipe/",
            "https://tasty.co/recipe/baked-lobster-tails",
            "https://tasty.co/recipe/keto-bacon-cauliflower-mac-n-cheese",
            "https://www.foodfaithfitness.com/no-bake-whole30-apple-almond-butter-bars",
            "https://tasty.co/recipe/easy-butter-chicken",
            "https://mxriyum.com/cinnamon-rolls/",
            "897399ef-2d4b-40a5-8d72-704c675fea24",
            "https://www.modernhoney.com/the-best-pumpkin-pie-recipe/"
        ];
        for uuid in &uuids {
            let body = format!(
                r#"{{
                    "owner": "dmbluesmith",
                    "updated_recipe": {{
                        "uuid": "{}",
                        "owner": "dmbluesmith"
                    }}
                }}"#,
                uuid
            );
            let req = Request::new(Body::from(body));
            let res = aw!(handler(req));
            println!("Response: {:?}", res);
            assert_eq!(res.unwrap().status().as_u16(), 200);
        }
    }
}
