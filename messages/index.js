import { handleDigga } from "./handleDigga.js";

export async function handleMessage(message, db, currentUserId) {

  const messageHandlers = new Map([
    ["digga".replaceAll('d', 'n'), handleDigga],
    ["digger".replaceAll('d', 'n'), handleDigga],

  ]);

  let handler = null;

  for (let [prefix, func] of messageHandlers) {
    if (message.content.toLowerCase().includes(prefix)) {
      handler = func;
      break;
    }
  }

  if (handler)  handler(message, db, currentUserId);
}
