import { controlApi } from "./api-client";
import type {
  ControlDataResponse,
  RobotCredential,
  RobotPermission,
} from "./models";

export type RobotMutationPayload = {
  name: string;
  description: string;
  level: "project" | "system";
  duration: number;
  disable: boolean;
  permissions: RobotPermission[];
};

type RobotUpdatePayload = Pick<
  RobotMutationPayload,
  "description" | "disable" | "duration" | "level" | "name" | "permissions"
>;

export function robotUpdatePayload(
  payload: RobotMutationPayload,
  name = payload.name,
): RobotUpdatePayload {
  return {
    name,
    description: payload.description,
    level: payload.level,
    duration: payload.duration,
    disable: payload.disable,
    permissions: payload.permissions,
  };
}

export async function createRobotAccount(
  payload: RobotMutationPayload,
  messages: { missingId: string; missingSecret: string },
): Promise<RobotCredential> {
  const response = await controlApi.mutate<
    ControlDataResponse<RobotCredential>
  >("robots", {}, "POST", payload);
  const credential = response.data;
  if (!credential?.secret) throw new Error(messages.missingSecret);

  // Harbor 2.15 accepts `disable` on create but does not persist it.
  if (payload.disable) {
    if (!credential.id) throw new Error(messages.missingId);
    await controlApi.mutate(
      "robot",
      { id: credential.id },
      "PUT",
      robotUpdatePayload(payload, credential.name),
    );
  }

  return credential;
}
