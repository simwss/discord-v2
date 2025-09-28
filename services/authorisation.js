import { ref, get } from "firebase/database";

export async function isUserAuthorised(db, userId) {
  try {
    const authorisedRef = ref(db, `users/${userId}`);
    const authorisedSnapshot = await get(authorisedRef);
    const verifiedUsers = authorisedSnapshot.val();
    return verifiedUsers && verifiedUsers.authorised;
  } catch (error) {
    console.error("Error checking user authorization:", error);
    return false;
  }
}
