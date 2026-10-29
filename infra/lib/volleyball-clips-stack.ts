import * as fs from "node:fs";
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import { Construct } from "constructs";

/** Create once: `aws ssm put-parameter --name … --type SecureString`. CloudFormation cannot. */
export const TRANSCODE_WEBHOOK_SECRET_PARAMETER =
  "/volleyball-clips/transcode-webhook-secret";

function decodePemInput(value: string) {
  const trimmed = value.trim();
  if (trimmed.includes("BEGIN")) {
    return trimmed.replace(/\\n/g, "\n");
  }
  const decoded = Buffer.from(trimmed, "base64").toString("utf8");
  if (decoded.includes("BEGIN")) {
    return decoded;
  }
  return trimmed.replace(/\\n/g, "\n");
}

/** Public key only. Never pass the private key as context. */
export function readCloudFrontPublicKeyPem(scope: Construct) {
  const rawPem = scope.node.tryGetContext("cloudfrontPublicKeyPem") as
    | string
    | undefined;
  const keyPath = scope.node.tryGetContext("cloudfrontPublicKeyPath") as
    | string
    | undefined;

  let pem = "";
  if (typeof rawPem === "string" && rawPem.trim()) {
    pem = decodePemInput(rawPem);
  } else if (typeof keyPath === "string" && keyPath.trim()) {
    const resolved = path.isAbsolute(keyPath)
      ? keyPath
      : path.resolve(process.cwd(), keyPath);
    if (!fs.existsSync(resolved)) {
      throw new Error(`cloudfrontPublicKeyPath not found: ${resolved}`);
    }
    pem = decodePemInput(fs.readFileSync(resolved, "utf8"));
  } else {
    throw new Error(
      "VolleyballClipsStack needs a CloudFront public key. Pass -c cloudfrontPublicKeyPath=/path/to/cloudfront-public.pem or -c cloudfrontPublicKeyPem='-----BEGIN PUBLIC KEY-----\\n...'. Do not pass or commit the private key.",
    );
  }

  if (!pem.includes("BEGIN PUBLIC KEY") && !pem.includes("BEGIN RSA PUBLIC KEY")) {
    throw new Error(
      "CloudFront public key must be a PEM public key (BEGIN PUBLIC KEY).",
    );
  }
  return pem;
}

export class VolleyballClipsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const teamSlug = String(
      this.node.tryGetContext("vercelTeamSlug") ?? "focus-otters-projects",
    );
    const projectName = String(
      this.node.tryGetContext("vercelProjectName") ?? "volleyball-clips",
    );
    const allowedOrigins = String(
      this.node.tryGetContext("allowedOrigins") ??
        "http://localhost:3000,https://vbpov.com,https://www.vbpov.com",
    )
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean);
    const webhookUrl = String(
      this.node.tryGetContext("webhookUrl") ??
        "https://REPLACE_ME.vercel.app/api/webhooks/transcode",
    );
    const existingOidcArn = this.node.tryGetContext("vercelOidcProviderArn") as
      | string
      | undefined;
    const publicKeyPem = readCloudFrontPublicKeyPem(this);
    const lockUploads =
      String(this.node.tryGetContext("lockUploads") ?? "true").toLowerCase() !==
      "false";
    const lockPlayback =
      String(this.node.tryGetContext("lockPlayback") ?? "false").toLowerCase() ===
      "true";

    const bucket = new s3.Bucket(this, "MediaBucket", {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: false,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.PUT,
            s3.HttpMethods.GET,
            s3.HttpMethods.HEAD,
          ],
          allowedOrigins,
          allowedHeaders: ["*"],
          exposedHeaders: ["ETag", "Content-Length"],
          maxAge: 3600,
        },
      ],
      // Instant public downloads: Intelligent-Tiering Frequent/Infrequent only.
      // Do not add intelligentTieringConfigurations (Archive / Deep Archive Access).
      // Posters stay in Standard (no prefix rule). No Glacier Flexible or Deep Archive.
      lifecycleRules: [
        {
          id: "uploads-intelligent-tiering",
          prefix: "uploads/",
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(0),
            },
          ],
        },
        {
          id: "playback-intelligent-tiering",
          prefix: "playback/",
          transitions: [
            {
              storageClass: s3.StorageClass.INTELLIGENT_TIERING,
              transitionAfter: cdk.Duration.days(0),
            },
          ],
        },
        {
          id: "abort-incomplete-multipart-uploads",
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
    });

    const ffmpegLayer = new lambda.LayerVersion(this, "FfmpegLayer", {
      description: "Static ffmpeg and ffprobe binaries",
      compatibleRuntimes: [lambda.Runtime.NODEJS_22_X],
      compatibleArchitectures: [lambda.Architecture.X86_64],
      code: lambda.Code.fromAsset(path.join(__dirname, "../layers/ffmpeg")),
    });

    const transcodeFn = new lambda.Function(this, "TranscodeFn", {
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.X86_64,
      handler: "index.handler",
      code: lambda.Code.fromAsset(path.join(__dirname, "../lambda/transcode")),
      memorySize: 10240,
      timeout: cdk.Duration.minutes(15),
      ephemeralStorageSize: cdk.Size.gibibytes(5),
      layers: [ffmpegLayer],
      environment: {
        PATH: "/opt/bin:/var/lang/bin:/usr/local/bin:/usr/bin:/bin",
        BUCKET: bucket.bucketName,
        WEBHOOK_URL: webhookUrl,
        WEBHOOK_SECRET_PARAMETER: TRANSCODE_WEBHOOK_SECRET_PARAMETER,
      },
      description: "Transcode Meta-glasses volleyball clips to 1080-wide H.264 + poster",
    });

    transcodeFn.addToRolePolicy(
      new iam.PolicyStatement({
        sid: "ReadWebhookSecret",
        actions: ["ssm:GetParameter"],
        resources: [
          cdk.Stack.of(this).formatArn({
            service: "ssm",
            resource: "parameter",
            resourceName: TRANSCODE_WEBHOOK_SECRET_PARAMETER.slice(1),
          }),
        ],
      }),
    );

    bucket.grantRead(transcodeFn, "uploads/*");
    bucket.grantWrite(transcodeFn, "playback/*");
    bucket.grantWrite(transcodeFn, "posters/*");
    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(transcodeFn),
      { prefix: "uploads/" },
    );

    const origin = origins.S3BucketOrigin.withOriginAccessControl(bucket);
    const downloadHeaders = new cloudfront.ResponseHeadersPolicy(
      this,
      "OriginalDownloadHeaders",
      {
        comment: "Force attachment downloads for original clips",
        customHeadersBehavior: {
          customHeaders: [
            {
              header: "Content-Disposition",
              value: "attachment",
              override: true,
            },
          ],
        },
        corsBehavior: {
          accessControlAllowCredentials: false,
          accessControlAllowHeaders: ["*"],
          accessControlAllowMethods: ["GET", "HEAD"],
          accessControlAllowOrigins: allowedOrigins,
          accessControlMaxAge: cdk.Duration.seconds(600),
          originOverride: true,
        },
      },
    );

    const mediaHeaders = new cloudfront.ResponseHeadersPolicy(this, "MediaHeaders", {
      comment: "CORS for playback and posters",
      corsBehavior: {
        accessControlAllowCredentials: false,
        accessControlAllowHeaders: ["*"],
        accessControlAllowMethods: ["GET", "HEAD"],
        accessControlAllowOrigins: allowedOrigins,
        accessControlMaxAge: cdk.Duration.seconds(600),
        originOverride: true,
      },
    });

    const signingPublicKey = new cloudfront.PublicKey(this, "SigningPublicKey", {
      comment:
        "volleyball-clips signing key (uploads + playback)",
      encodedKey: publicKeyPem,
    });
    const signingKeyGroup = new cloudfront.KeyGroup(this, "SigningKeyGroup", {
      comment: "Trusted signers for originals and 1080p playback copies",
      items: [signingPublicKey],
    });

    const distribution = new cloudfront.Distribution(this, "Cdn", {
      comment: "volleyball-clips media",
      defaultBehavior: {
        origin,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        responseHeadersPolicy: mediaHeaders,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
      },
      additionalBehaviors: {
        "uploads/*": {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy: downloadHeaders,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          trustedKeyGroups: lockUploads ? [signingKeyGroup] : undefined,
        },
        // Separate from default so posters/* stay public when playback is locked.
        "playback/*": {
          origin,
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
          originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
          responseHeadersPolicy: mediaHeaders,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          trustedKeyGroups: lockPlayback ? [signingKeyGroup] : undefined,
        },
      },
    });

    const issuerHost = `oidc.vercel.com/${teamSlug}`;
    const audience = `https://vercel.com/${teamSlug}`;
    const provider = existingOidcArn
      ? iam.OpenIdConnectProvider.fromOpenIdConnectProviderArn(
          this,
          "VercelOidc",
          existingOidcArn,
        )
      : new iam.OpenIdConnectProvider(this, "VercelOidc", {
          url: `https://${issuerHost}`,
          clientIds: [audience],
        });

    const vercelRole = new iam.Role(this, "VercelPresignRole", {
      roleName: "volleyball-clips-vercel-presign",
      description:
        "Vercel OIDC role for S3 presign uploads and clip/game object deletes",
      assumedBy: new iam.FederatedPrincipal(
        provider.openIdConnectProviderArn,
        {
          StringEquals: {
            [`${issuerHost}:aud`]: audience,
          },
          StringLike: {
            [`${issuerHost}:sub`]: `owner:${teamSlug}:project:${projectName}:environment:*`,
          },
        },
        "sts:AssumeRoleWithWebIdentity",
      ),
    });

    vercelRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "PresignUploadOnly",
        actions: [
          "s3:PutObject",
          "s3:AbortMultipartUpload",
          "s3:ListMultipartUploadParts",
        ],
        resources: [bucket.arnForObjects("uploads/*")],
      }),
    );

    vercelRole.addToPolicy(
      new iam.PolicyStatement({
        sid: "DeleteClipMedia",
        actions: ["s3:DeleteObject"],
        resources: [
          bucket.arnForObjects("uploads/*"),
          bucket.arnForObjects("playback/*"),
          bucket.arnForObjects("posters/*"),
        ],
      }),
    );

    new cdk.CfnOutput(this, "AWS_REGION", {
      value: this.region,
      description: "Set AWS_REGION in Vercel to this exact region",
    });
    new cdk.CfnOutput(this, "AWS_S3_BUCKET", {
      value: bucket.bucketName,
    });
    new cdk.CfnOutput(this, "AWS_ROLE_ARN", {
      value: vercelRole.roleArn,
    });
    new cdk.CfnOutput(this, "NEXT_PUBLIC_CDN_URL", {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, "CLOUDFRONT_KEY_PAIR_ID", {
      value: signingPublicKey.publicKeyId,
      description: "Set CLOUDFRONT_KEY_PAIR_ID in Vercel (preview + production)",
    });
    new cdk.CfnOutput(this, "CLOUDFRONT_UPLOADS_LOCKED", {
      value: lockUploads ? "true" : "false",
      description: "Unsigned uploads/* requests fail with 403 when true",
    });
    new cdk.CfnOutput(this, "CLOUDFRONT_PLAYBACK_LOCKED", {
      value: lockPlayback ? "true" : "false",
      description: "Unsigned playback/* requests fail with 403 when true",
    });
    new cdk.CfnOutput(this, "TRANSCODE_WEBHOOK_SECRET_PARAMETER", {
      value: TRANSCODE_WEBHOOK_SECRET_PARAMETER,
      description:
        "SSM SecureString name. Create it once, then copy the decrypted value into TRANSCODE_WEBHOOK_SECRET",
    });
  }
}
