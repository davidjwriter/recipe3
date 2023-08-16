# Tesseract Service

To install, follow these instructions:

- Build using Dockerfile.b
- Push the build docker image to docker hub using your own tag
- Change the tag in the Dockerfile and Dockerrun.aws.json to yours
- Package Dockerfile and Dockerrun.aws.json into a .zip file
- Create an elasticbeanstalk environment using Docker and upload the .zip
