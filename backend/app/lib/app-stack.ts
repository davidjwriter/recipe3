import { Runtime, Function, Code } from 'aws-cdk-lib/aws-lambda';
import * as sns from 'aws-cdk-lib/aws-sns';
import { App, Stack, RemovalPolicy } from 'aws-cdk-lib';
import { Rule, Schedule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { IResource, LambdaIntegration, MockIntegration, PassthroughBehavior, RestApi, Cors } from 'aws-cdk-lib/aws-apigateway';
import { AttributeType, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Duration } from 'aws-cdk-lib';
import * as dotenv from 'dotenv';
import path = require('path');
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

export class Recipe3Stack extends Stack {
  constructor(app: App, id: string) {
    super(app, id);
    dotenv.config({ path: path.resolve(__dirname, '.env') });
    const openAiApiKey = process.env.OPEN_AI_API_KEY || 'NO_API_KEY';

    // Setup our dynamo db table
    const dynamoTable = new Table(this, 'Recipes', {
      partitionKey: {
        name: 'uuid',
        type: AttributeType.STRING
      },
      readCapacity: 1,
      writeCapacity: 1,
      tableName: 'Recipes',

      /**
       *  The default removal policy is RETAIN, which means that cdk destroy will not attempt to delete
       * the new table, and it will remain in your account until manually deleted. By setting the policy to
       * DESTROY, cdk destroy will delete the table (even if it has data in it)
       */
      removalPolicy: RemovalPolicy.DESTROY, // NOT recommended for production code
    });


    // Lambda function to add a new recipe
    // Expects a string URL
    const addRecipeWorker = new Function(this, 'addRecipeWorker', {
      description: "Add recipes worker",
      code: Code.fromAsset('lib/lambdas/addRecipeWorker/target/x86_64-unknown-linux-musl/release/lambda'),
      runtime: Runtime.PROVIDED_AL2,
      handler: 'not.required',
      timeout: Duration.minutes(5),
      environment: {
        RUST_BACKTRACE: '1',
        TABLE_NAME: 'Recipes',
        OPEN_AI_API_KEY: openAiApiKey,
      },
      logRetention: RetentionDays.ONE_WEEK
    });

    // Create an SNS topic and subscribe the addRecipeWorker Lambda function
    const recipeTopic = new sns.Topic(this, 'AddRecipeTopic');
    recipeTopic.addSubscription(new LambdaSubscription(addRecipeWorker));

    const addRecipe = new Function(this, 'addRecipe', {
      description: "Add recipes worker",
      code: Code.fromAsset('lib/lambdas/addRecipe/target/x86_64-unknown-linux-musl/release/lambda'),
      runtime: Runtime.PROVIDED_AL2,
      handler: 'not.required',
      timeout: Duration.minutes(5),
      environment: {
        RUST_BACKTRACE: '1',
        TABLE_NAME: 'Recipes',
        SNS_ARN: recipeTopic.topicArn
      },
      logRetention: RetentionDays.ONE_WEEK
    });

    recipeTopic.grantPublish(addRecipe);

    // Gets all recipes from dynamoDB
    const getRecipes = new Function(this, 'getRecipes', {
      description: "Add recipes",
      code: Code.fromAsset('lib/lambdas/getRecipes/target/x86_64-unknown-linux-musl/release/lambda'),
      runtime: Runtime.PROVIDED_AL2,
      handler: 'not.required',
      environment: {
        RUST_BACKTRACE: '1',
        TABLE_NAME: 'Recipes',
      },
      logRetention: RetentionDays.ONE_WEEK
    });

    // Grant the lambda functions write and read access
    dynamoTable.grantFullAccess(getRecipes);
    dynamoTable.grantFullAccess(addRecipe);
    dynamoTable.grantFullAccess(addRecipeWorker);    

    // Create an API Gateway resource for each of the CRUD operations
    const api = new RestApi(this, 'Recipe3API', {
      restApiName: 'Recipe3 API',
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
        allowHeaders: Cors.DEFAULT_HEADERS,
      }
    });

    // Integrate lambda functions with an API gateway
    const getRecipesAPI = new LambdaIntegration(getRecipes);
    const addRecipeAPI = new LambdaIntegration(addRecipe);

    const books = api.root.addResource('api');
    books.addMethod('POST', addRecipeAPI);
    books.addMethod('GET', getRecipesAPI);
  }
}

export function addCorsOptions(apiResource: IResource, httpMethod: string) {
  apiResource.addMethod(httpMethod, new MockIntegration({
    integrationResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Credentials': "'false'",
        'method.response.header.Access-Control-Allow-Methods': "'OPTIONS,GET,PUT,POST,DELETE'",
      },
    }],
    passthroughBehavior: PassthroughBehavior.NEVER,
    requestTemplates: {
      "application/json": "{\"statusCode\": 200}"
    },
  }), {
    methodResponses: [{
      statusCode: '200',
      responseParameters: {
        'method.response.header.Access-Control-Allow-Headers': true,
        'method.response.header.Access-Control-Allow-Methods': true,
        'method.response.header.Access-Control-Allow-Credentials': true,
        'method.response.header.Access-Control-Allow-Origin': true,
      },
    }]
  });
}

const app = new App();
new Recipe3Stack(app, 'Recipe3Stack');
app.synth();
