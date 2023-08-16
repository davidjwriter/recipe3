FROM rust:latest as builder
WORKDIR /app
COPY ./src ./src
COPY ./Cargo.toml ./
RUN cargo install --path . 

FROM ubuntu:20.04 as runner
# Install Tesseract and any required dependencies
RUN apt-get update && \
    apt-get install -y tesseract-ocr && \
    apt-get install -y libtesseract-dev
COPY --from=builder /usr/local/cargo/bin/tesseract-service /usr/local/bin/tesseract-service
ENV ROCKET_ADDRESS=0.0.0.0
EXPOSE 8000
CMD ["tesseract-service"]