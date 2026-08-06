/** Admin role guard for FlashTopup server functions (server-only). */
export async function assertAdmin(client: any, userId: string) {
  const { data } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden");
}
