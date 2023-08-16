use reqwest::Body;
use rocket::data::Data;
use rocket::data::ToByteUnit;
use rocket::fairing::AdHoc;
use rocket::fairing::{Fairing, Info, Kind};
use rocket::fs::NamedFile;
use rocket::http::ContentType;
use rocket::http::Header;
use rocket::http::MediaType;
use rocket::http::Status;
use rocket::response::status::NotFound;
use rocket::serde::json::Json;
use rocket::serde::Serialize;
use rocket::{Request, Response};
use serde_json;
use rocket::serde::Deserialize;
use tokio::io::AsyncWriteExt;
use tokio::fs::File as AsyncFile;
use tokio::time::Duration;
use std::error::Error;
use reqwest::get;
use rusty_tesseract::{Args, Image};
use std::fmt::{Display, Formatter, Result as FmtResult};

/**
 * All our structs we need throughout the service
 */

 /**
  * First we have CORS setup
  */
pub struct CORS;

#[rocket::async_trait]
impl Fairing for CORS {
    fn info(&self) -> Info {
        Info {
            name: "Attaching CORS headers to responses",
            kind: Kind::Response,
        }
    }

    async fn on_response<'r>(&self, _request: &'r Request<'_>, response: &mut Response<'r>) {
        response.set_header(Header::new("Access-Control-Allow-Origin", "*"));
        response.set_header(Header::new(
            "Access-Control-Allow-Methods",
            "POST, GET, PATCH, OPTIONS",
        ));
        response.set_header(Header::new("Access-Control-Allow-Headers", "*"));
        response.set_header(Header::new("Access-Control-Allow-Credentials", "true"));
    }
}

/**
 * Next we have our custom error
 */
#[derive(Debug)]
pub struct ImageError {
    pub message: String
}

impl Display for ImageError {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        write!(f, "{}", self.message)
    }
}

impl Error for ImageError {}

/**
 * Here we have our request and response structs
 */
#[derive(Deserialize)]
#[serde(crate = "rocket::serde")]
pub struct TesseractRequest<'r> {
    pub url: &'r str
}

#[derive(Serialize, Deserialize, Debug)]
pub struct TesseractResponse {
    pub contents: String
}

#[macro_use]
extern crate rocket;

fn get_image_extension(url: &str) -> Option<&str> {
    let path = url.split('/').last()?; // Get the last part of the URL, which should be the filename
    let parts: Vec<&str> = path.split('.').collect(); // Split the filename by dot
    parts.last().copied() // Return the last part (extension) if available
}

async fn wait_for_file(file_path: &str, max_retries: usize) -> bool {
    let mut retries = 0;
    while retries < max_retries {
        if std::path::Path::new(file_path).exists() {
            return true;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
        retries += 1;
    }
    false
}

async fn get_image_contents(url: &str) -> Result<String, Box<dyn Error>> {
    // First get the image
    let response = get(url).await?;

    // Write the image to a file
    let ext = get_image_extension(url).unwrap();
    let file_name = format!("/tmp/image.{}", ext);
    let mut dest = AsyncFile::create(&file_name).await.unwrap();
    let bytes = response.bytes().await.unwrap();
    dest.write_all(&bytes).await.unwrap();

    // Wait for the file to be available
    let max_retries = 10; // Adjust as needed
    if !wait_for_file(&file_name, max_retries).await {
        return Err(Box::new(ImageError {
            message: "Failed to write image file".to_string(),
        }));
    }

    // Setup arguments for tesseract
    let default_args = Args::default();

    // Create an image struct
    let image = Image::from_path(&file_name).unwrap();
    println!("Image: {:?}", image);

    //tesseract version
    let tesseract_version = rusty_tesseract::get_tesseract_version().unwrap();
    println!("The tesseract version is: {:?}", tesseract_version);

    //available languages
    let tesseract_langs = rusty_tesseract::get_tesseract_langs().unwrap();
    println!("The available languages are: {:?}", tesseract_langs);

    //available config parameters
    let parameters = rusty_tesseract::get_tesseract_config_parameters().unwrap();
    println!("Example config parameter: {}", parameters.config_parameters.first().unwrap());
    // Analyze image and extract text
    let output = rusty_tesseract::image_to_string(&image, &default_args).unwrap();
    Ok(output)
}

#[get("/")]
async fn root() -> &'static str {
    "To read an image, submit POST to /image-to-text with a JSON body containing image URL"
}

#[post("/image-to-text", format = "application/json", data = "<req>")]
async fn image_to_text(req: Json<TesseractRequest<'_>>) -> String{
    println!("URL: {}", req.url);
    let image_contents = get_image_contents(&req.url).await.unwrap();
    let contents = TesseractResponse {
        contents: image_contents
    };
    serde_json::to_string(&contents).unwrap()
}

#[rocket::main]
async fn main() {
    rocket::build()
        .mount("/", routes![root])
        .mount("/api", routes![image_to_text])
        .attach(CORS)
        .launch()
        .await
        .expect("error launching");
}