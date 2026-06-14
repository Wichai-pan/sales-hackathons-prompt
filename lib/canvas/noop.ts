"use server";

// A real server action used as the form-action fallback in canvas screens when a page
// doesn't wire a specific action. Must be a "use server" function — a plain function
// passed to <form action={...}> throws "Functions cannot be passed directly to Client Components".
export async function noopAction(_formData?: FormData): Promise<void> {
  // intentionally does nothing
}
