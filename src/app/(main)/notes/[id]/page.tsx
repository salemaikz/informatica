import { NoteScreen } from "./NoteScreen";

export default async function NotePage(props: PageProps<"/notes/[id]">) {
  const { id } = await props.params;
  return <NoteScreen id={id} />;
}
