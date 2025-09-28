
export async function handleDigga(
  message,
  db,
  // currentUserId,
) {
 
  await message.reply({
    content: 'digga'.replaceAll('d', 'n')
  });
}


