#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { Recipe3Stack } from '../lib/app-stack';

const app = new cdk.App();
new Recipe3Stack(app, 'Recipe3Stack');