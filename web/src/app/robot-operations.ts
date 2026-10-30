import { UserInputError } from "./errors";
import type { RobotCredential, RobotPermission } from "./models";
import type { ControlMutate } from "./use-control-mutation";

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
  mutate: ControlMutate,
): Promise<RobotCredential> {
  const credential = await mutate<RobotCredential | null>({
    operation: "robots",
    parameters: {},
    method: "POST",
    payload: payload,
  });
  if (!credential?.secret) throw new UserInputError(messages.missingSecret);

  // Harbor 2.15 accepts `disable` on create but does not persist it.
  if (payload.disable) {
    if (!credential.id) throw new UserInputError(messages.missingId);
    await mutate({
      operation: "robot",
      parameters: { id: credential.id },
      method: "PUT",
      payload: robotUpdatePayload(payload, credential.name),
    });
  }

  return credential;
}
