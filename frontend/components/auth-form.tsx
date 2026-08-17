"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { EyeIcon, EyeOffIcon, KeyRoundIcon } from "lucide-react"
import { toast } from "sonner"

import BlurText from "@/components/BlurText"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Separator } from "@/components/ui/separator"
import {
  ApiError,
  getStoredApiKey,
  setStoredApiKey,
  verifyApiKey,
} from "@/lib/api"

export function AuthForm() {
  const router = useRouter()
  const [apiKey, setApiKey] = React.useState("")
  const [visible, setVisible] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [pending, setPending] = React.useState(false)

  React.useEffect(() => {
    const saved = getStoredApiKey()
    if (saved) setApiKey(saved)
  }, [])

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const value = apiKey.trim()

    if (!value) {
      setError("Enter your Luraph API key.")
      return
    }

    if (value.length < 8) {
      setError("That key looks too short.")
      return
    }

    setError(null)
    setPending(true)

    try {
      await verifyApiKey(value)
      setStoredApiKey(value)
      window.localStorage.setItem("luraph-theme-choice", "A")
      toast.success("Signed in")
      router.push("/dashboard")
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Could not reach the backend. Is it running on :8787?"
      setError(message)
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4">
      <div className="flex flex-col items-center gap-5 text-center">
        <span className="text-base font-medium tracking-tight">LURAPH API</span>

        <BlurText
          text="Sign in to your account."
          className="justify-center text-3xl font-semibold tracking-tight text-foreground md:text-4xl"
          delay={80}
          animateBy="words"
          direction="top"
        />
      </div>

      <form onSubmit={onSubmit} className="flex w-full flex-col gap-5">
        <FieldGroup>
          <Field data-invalid={Boolean(error) || undefined}>
            <FieldLabel htmlFor="api-key" className="sr-only">
              API Key
            </FieldLabel>
            <InputGroup className="h-11 rounded-xl bg-secondary/80">
              <InputGroupAddon>
                <KeyRoundIcon />
              </InputGroupAddon>
              <InputGroupInput
                id="api-key"
                name="apiKey"
                type={visible ? "text" : "password"}
                autoComplete="off"
                spellCheck={false}
                placeholder="Paste your API key"
                value={apiKey}
                aria-invalid={Boolean(error) || undefined}
                onChange={(event) => {
                  setApiKey(event.target.value)
                  if (error) setError(null)
                }}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={visible ? "Hide API key" : "Show API key"}
                  onClick={() => setVisible((v) => !v)}
                >
                  {visible ? <EyeOffIcon /> : <EyeIcon />}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription>
              Key stays on this device and is sent only to your local backend,
              which proxies Luraph API calls.
            </FieldDescription>
            {error ? <FieldError>{error}</FieldError> : null}
          </Field>
        </FieldGroup>

        <Button
          type="submit"
          size="lg"
          disabled={pending}
          className="h-11 w-full rounded-full text-sm font-medium"
        >
          {pending ? "Verifying…" : "Continue with API Key"}
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <Button
          type="button"
          variant="secondary"
          className="h-10 w-full rounded-full"
          nativeButton={false}
          render={
            <a href="https://lura.ph" target="_blank" rel="noreferrer" />
          }
        >
          Get an API key
        </Button>
      </form>
    </div>
  )
}
