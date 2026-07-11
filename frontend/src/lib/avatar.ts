/**
 * Profile picture — pick one, and keep it.
 *
 * `launchImageLibraryAsync` hands back a URI in the app's **cache** directory, which iOS
 * is free to purge whenever storage runs low. Persisting that URI would give you an
 * avatar that quietly disappears weeks later. So the pick is copied into the documents
 * directory, and it is that copy's URI the store holds.
 *
 * The picture never leaves the device: there is no upload, and no column for it. It is
 * the one piece of the profile the server has no opinion about.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const AVATAR_DIR = 'avatar';

function avatarDirectory(): Directory {
  const dir = new Directory(Paths.document, AVATAR_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Best-effort delete of a previous avatar. A leftover file is not worth an error. */
export function discardAvatar(uri: string | null): void {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // The file was already gone, or lives somewhere we can't touch. Either is fine.
  }
}

/**
 * Present the system photo picker and return a durable `file://` URI, or `null` if the
 * user cancelled.
 *
 * No permission request: iOS's `PHPickerViewController` runs out of process and hands
 * back only the chosen image, so the app never gains access to the library and never has
 * to ask for it.
 */
export async function pickAvatar(previous: string | null): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.85,
  });

  const asset = result.canceled ? undefined : result.assets?.[0];
  if (!asset) return null;

  const source = new File(asset.uri);
  const extension = source.extension || '.jpg';
  // Timestamped, so a replacement never collides with a cached render of the old file.
  const destination = new File(avatarDirectory(), `avatar-${Date.now()}${extension}`);

  await source.copy(destination);
  discardAvatar(previous);

  return destination.uri;
}
