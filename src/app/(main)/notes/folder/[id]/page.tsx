import { FolderScreen } from "./FolderScreen";

export default async function FolderPage(props: PageProps<"/notes/folder/[id]">) {
  const { id } = await props.params;
  return <FolderScreen id={id} />;
}
