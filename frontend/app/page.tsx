import { AuthForm } from "@/components/auth-form"
import { Spotlight } from "@/components/ui/spotlight"

export default function Page() {
  return (
    <div className="relative flex min-h-svh flex-col overflow-hidden bg-background">
      <Spotlight
        className="-top-40 left-0 md:-top-20 md:left-60"
        fill="white"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,rgba(47,95,191,0.18),transparent_55%)]"
      />

      <main className="relative z-10 flex flex-1 items-center justify-center py-16">
        <AuthForm />
      </main>
    </div>
  )
}
