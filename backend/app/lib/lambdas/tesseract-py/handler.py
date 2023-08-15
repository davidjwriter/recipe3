from Pillow import Image
import requests
import pytesseract
from io import BytesIO


def main(evt, ctx):
    url = evt["body"]
    print(url)
    res = requests.get(url["url"])
    img = Image.open(BytesIO(res.content))
    txt = pytesseract.image_to_string(img, lang="eng")
    return {"statusCode": 200, "body": txt}
