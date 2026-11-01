import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand, TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { actorKey, ddb, movieKey, type Role, tableName } from "../shared/db";
import { isResponse, parseJsonObject, response } from "../shared/http";

export const handler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  const body = parseJsonObject(event);
  if (isResponse(body)) return body;

  if (
    typeof body.movieId !== "number" ||
    !Number.isInteger(body.movieId) ||
    body.movieId <= 0
  ) {
    return response(400, { message: "movieId must be a positive integer" });
  }

  if (
    typeof body.actorId !== "number" ||
    !Number.isInteger(body.actorId) ||
    body.actorId <= 0
  ){
    return response(400, { message: "actorId must be a positive integer" });
  }

  if (
    typeof body.roleName !== "string" ||
    body.roleName.trim().length === 0
  ){
    return response(400, { message: "roleName must be a non-empty string" });
  }

  if (
    typeof body.roleDescription !== "string" ||
    body.roleDescription.trim().length === 0
  ){
    return response(400, { message: "roleDescription must be a non-empty string" });
  }

  const role: Role = {
    movieId: body.movieId as number,
    actorId: body.actorId as number,
    roleName: body.roleName as string,
    roleDescription: body.roleDescription as string,
  };

  try {
    const movieResult = await ddb.send(
      new GetCommand({
        TableName: tableName,
        Key: { 
        PK: movieKey(role.movieId),
        SK: movieKey(role.movieId)
      },
    })
  );

  if (!movieResult.Item) {
    return response(404, { 
      message: `Movie ${role.movieId} not found` });
  }

  const actorResult = await ddb.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        PK: actorKey(role.actorId),
        SK: actorKey(role.actorId)
      },
    })
  );

  if (!actorResult.Item) {
    return response(404, {
      message: `Actor ${role.actorId} not found` });
  }

  await ddb.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: {
              PK: movieKey(role.movieId),
              SK: actorKey(role.actorId),
              ...role,
            },
            ConditionExpression: "attribute_not_exists(PK) AND attribute_not_exists(SK)", 
          },
        },
      ],
    })
  );

  return response(201, { message: "Role added", data: role });
  } catch (err) {
    console.error("DynamoDB error:", err);
    return response(500, {
      message: "Internal server error",
      error: err,
    });
  }
};
