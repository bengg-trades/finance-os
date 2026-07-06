import MoneyLoader from "@/components/MoneyLoader";

// Route-level loading state (shows while server pages fetch)
export default function Loading() {
  return (
    <main className="flex min-h-dvh items-center justify-center">
      <MoneyLoader />
    </main>
  );
}
