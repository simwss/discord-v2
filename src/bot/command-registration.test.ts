import { describe, expect, it } from "vitest";
import { commandsFingerprint } from "./command-registration.js";

const discord = { token: "t", applicationId: "app", guildId: undefined };
const bodies = [{ name: "profile", description: "x" }];

describe("commandsFingerprint", () => {
  it("is stable for the same input", () => {
    expect(commandsFingerprint(discord, bodies)).toBe(
      commandsFingerprint(discord, [...bodies]),
    );
  });

  it("changes when a command changes", () => {
    expect(commandsFingerprint(discord, bodies)).not.toBe(
      commandsFingerprint(discord, [{ name: "profile", description: "y" }]),
    );
  });

  it("changes when the registration target changes", () => {
    expect(commandsFingerprint(discord, bodies)).not.toBe(
      commandsFingerprint({ ...discord, guildId: "guild" }, bodies),
    );
  });

  it("ignores the token", () => {
    expect(commandsFingerprint(discord, bodies)).toBe(
      commandsFingerprint({ ...discord, token: "other" }, bodies),
    );
  });
});
