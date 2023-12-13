use lambda_http::{service_fn, Response, Body, Error, Request};
use serde_json::json;
use serde::Deserialize;
use serde::Serialize;
use reqwest;
use dotenv::dotenv;
use std::env;


// Constants
const PROMPT: &str = "What is the text in this image?";

// Tesseract Request
#[derive(Deserialize, Debug)]
pub struct TesseractRequest {
    pub url: String
}

// OpenAIImageURL
#[derive(Serialize, Debug)]
pub struct OpenAIImageURL {
    pub url: String
}

// OpenAITextContent
#[derive(Serialize, Debug)]
pub struct OpenAITextContent {
    #[serde(rename = "type")]
    pub content_type: String,
    pub text: String
}

// OpenAIImageContent
#[derive(Serialize, Debug)]
pub struct OpenAIImageContent {
    #[serde(rename = "type")]
    pub content_type: String,
    pub image_url: OpenAIImageURL
}

// OpenAIContent
#[derive(Serialize, Debug)]
#[serde(tag = "type")]
pub enum OpenAIContent {
    #[serde(rename = "text")]
    TextContent(OpenAITextContent),
    #[serde(rename = "image_url")]
    ImageContent(OpenAIImageContent),
}

// OpenAIMessage
#[derive(Serialize, Debug)]
pub struct OpenAIMessage {
    pub role: String,
    pub content: Vec<OpenAIContent>
}

// OpenAI Request
#[derive(Serialize, Debug)]
pub struct OpenAIRequest {
    pub model: String,
    pub messages: Vec<OpenAIMessage>,
    pub max_tokens: u16
}

impl OpenAIRequest {
    pub fn from(url: String) -> OpenAIRequest {
        let image_url = OpenAIImageURL {
            url: url
        };
        let prompt_content = OpenAITextContent {
            content_type: String::from("text"),
            text: PROMPT.to_string()
        };
        let image_content = OpenAIImageContent {
            content_type: String::from("image_url"),
            image_url: image_url
        };
        let message = OpenAIMessage {
            role: String::from("user"),
            content: vec![OpenAIContent::TextContent(prompt_content), OpenAIContent::ImageContent(image_content)]
        };
        OpenAIRequest {
            model: String::from("gpt-4-vision-preview"),
            messages: vec![message],
            max_tokens: 300
        }
    }
}

// OpenAI Response
#[derive(Deserialize, Debug)]
pub struct OpenAIResponse {
    pub json: String
}

// Tesseract Response
#[derive(Serialize, Debug)]
pub struct TesseractResponse {
    pub contents: String
}

async fn get_api_key() -> Option<String> {
    env::var("OPEN_AI_API_KEY").ok()
}

async fn tesseract(url: TesseractRequest) -> Result<TesseractResponse, Error> {
    let request = OpenAIRequest::from(url.url);
    // Serialize the struct to JSON
    let json_string = serde_json::to_string(&request).unwrap();

    // Print the JSON string
    println!("Request: {}", json_string);
    let client = reqwest::Client::new();
    let uri = "https://api.openai.com/v1/chat/completions";

    let response = client
        .post(uri)
        .header("Authorization", format!("Bearer {}", get_api_key().await.unwrap()))
        .json(&request)
        .send()
        .await.unwrap();

    println!("Response: {:?}", response);
    Ok(TesseractResponse {
        contents: response.text().await?
    })
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    let func = service_fn(handler);
    lambda_http::run(func).await?;

    Ok(())
}

async fn handler(request: Request) -> Result<Response<String>, Error> {
    // 1. Get URL from request body
    let body = request.body();
    let url: TesseractRequest = serde_json::from_slice(&body)?;

    // 2. Call Tesseract Function and return success/failure
    match tesseract(url).await {
        Ok(resp) => {
            return Ok(Response::builder()
                .status(200)
                .header("Access-Control-Allow-Origin", "*")
                .body(resp.contents)?);
        },
        Err(e) => {
            return Ok(Response::builder()
                .status(400)
                .header("Access-Control-Allow-Origin", "*")
                .body(format!("Tesseract Failure: {:?}", e))?);
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
    fn test_tesseract() {
        dotenv::from_filename("../../.env").ok();
        let body = r#"
        {
            "url": "https://recipe3stack-recipeuploads4499815a-imruc63nb0r1.s3.amazonaws.com/image.jpg"
        }"#;
        let req = Request::new(Body::from(body));
        println!("Request: {:?}", req);
        let res = aw!(handler(req));
        println!("Response: {:?}", res);
        assert_eq!(res.unwrap().status().as_u16(), 200);
    }
}