import { initializeApp, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";
import { getEnv } from "../../config/env.js";

export interface FirebaseContext {
  readonly app: FirebaseApp;
  readonly db: Database;
}

/**
 * Builds the Firebase handles. Called once from the composition root; the
 * rest of the app receives `Database` by injection rather than importing a
 * module-level singleton, which is what made v1 untestable.
 */
export function createFirebase(): FirebaseContext {
  const { firebase } = getEnv();

  const app = initializeApp({
    apiKey: firebase.apiKey,
    databaseURL: firebase.databaseURL,
    projectId: firebase.projectId,
    ...(firebase.authDomain === undefined
      ? {}
      : { authDomain: firebase.authDomain }),
    ...(firebase.storageBucket === undefined
      ? {}
      : { storageBucket: firebase.storageBucket }),
    ...(firebase.messagingSenderId === undefined
      ? {}
      : { messagingSenderId: firebase.messagingSenderId }),
    ...(firebase.appId === undefined ? {} : { appId: firebase.appId }),
  });

  return { app, db: getDatabase(app) };
}
