import { redirect } from "next/navigation";

// Students is the only section so far
export default function AppHome() {
  redirect("/app/students");
}
