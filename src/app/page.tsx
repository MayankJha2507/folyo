import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardBody,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Placeholder landing page. It exists so M0 has a page that exercises the
 * design tokens and base components; the real marketing surface lands later.
 */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-16 sm:py-24">
      <header className="flex flex-col items-start gap-4">
        <Badge tone="accent">Milestone 0 · foundation</Badge>
        <h1 className="text-3xl font-semibold sm:text-4xl">Folyo</h1>
        <p className="max-w-xl text-base text-ink-muted">
          A resume you can trust to read well and parse cleanly. Resume health
          and job match are scored separately, deterministically, and shown with
          the evidence behind every point.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Foundation in place</CardTitle>
          <CardDescription>
            Design tokens, base components, linting, type checking and tests.
            Feature work begins at M1.
          </CardDescription>
        </CardHeader>
        <CardBody className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </CardBody>
      </Card>
    </main>
  );
}
