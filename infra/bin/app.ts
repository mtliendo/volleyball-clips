#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { VolleyballClipsStack } from "../lib/volleyball-clips-stack";

const app = new cdk.App();

const stack = new VolleyballClipsStack(app, "VolleyballClipsStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-2",
  },
  description: "S3, CloudFront, transcode Lambda, and Vercel OIDC role for volleyball-clips",
});

cdk.Tags.of(stack).add("project", "volleyball-clips");
