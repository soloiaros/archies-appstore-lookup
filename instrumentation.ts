export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { warmTowers } = await import(
    "./lib/retrieve/memory"
  );

  try {
    await warmTowers();
  } catch (error) {
    console.error(
      error instanceof Error
        ? error.message
        : "search warm failed",
    );
  }
}
