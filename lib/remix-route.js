import * as fsp from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import enquirer from "enquirer";
import { OpenAI } from "openai";
import { encoding_for_model } from "tiktoken";
import { LocalIndex } from "vectra";

import { ChatManager } from "./chat-manager.js";

const { prompt } = enquirer;

const MAX_EXAMPLE_TOKENS = 1600;

export async function remixRoute() {
  const requireFunc = createRequire(import.meta.url);
  const chadcnUIMetadata = requireFunc("../model/chadcn-ui/metadata.json");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const chadcnUIIndex = new LocalIndex(
    path.join(__dirname, "../model/chadcn-ui/index")
  );
  const lucidReactIndex = new LocalIndex(
    path.join(__dirname, "../model/lucid-react/index")
  );

  const { filename } = await prompt({
    type: "input",
    name: "filename",
    message: "What is the filename of the route module?",
    prefix: "app/routes/",
    required: true,
  });

  const descriptionResult = await prompt({
    type: "input",
    multiline: true,
    name: "description",
    message: "Describe what the route should do.",
    required: true,
  });
  const description = descriptionResult?.description;

  if (!description) {
    throw new Error("No description provided.");
  }

  const designChat = new ChatManager();
  designChat.regiesterFunction(
    {
      name: `designNewRouteModule`,
      description: `generate the required design details to create a new route module`,
      parameters: {
        type: "object",
        properties: {
          new_route_component_name: {
            type: "string",
            description: "the name of the new route component",
          },
          new_route_module_description: {
            type: "string",
            description: `Write a description for the Remix route module design task based on the user query. Stick strictly to what the user wants in their request - do not go off track`,
          },
          does_new_route_need_loader: {
            type: "boolean",
            description: "does the new route module need a loader export",
          },
          does_new_route_need_action: {
            type: "boolean",
            description: "does the new route module need an action export",
          },
          icons_to_use: {
            type: "object",
            description: "the icons and elements to use in the new component",
            properties: {
              does_new_component_need_icons: {
                type: "boolean",
                description: "does the new component need icons",
              },
              if_so_what_icons_are_needed: {
                type: "array",
                items: {
                  type: "string",
                  description: "the name of the icons needed",
                },
              },
            },
            required: ["if_so_what_icons_are_needed"],
          },
          ui_components_to_use: {
            type: "object",
            description:
              "the react ui components to to use in the new component",
            properties: {
              does_new_component_need_components: {
                type: "boolean",
                description: "does the new component need ui components",
              },
              if_so_what_components_are_needed: {
                type: "array",
                items: {
                  type: "string",
                  description: "the name of the components needed",
                },
              },
            },
            required: ["does_new_component_need_components"],
          },
          followup_questions: {
            type: "object",
            description: "followup questions to ask the user",
            properties: {
              does_new_component_need_followup_questions: {
                type: "boolean",
                description: "does the new component need followup questions",
              },
              if_so_what_followup_questions_are_needed: {
                type: "array",
                items: {
                  type: "string",
                  description: "the followup questions needed",
                },
              },
            },
          },
        },
        required: [
          "new_route_component_name",
          "new_route_module_description",
          "does_new_route_need_loader",
          "does_new_route_need_action",
          "icons_to_use",
          "ui_components_to_use",
          "followup_questions",
        ],
      },
    },
    (res) => res
  );
  designChat.addSystemMessages(
    "Your task is to write a detailed plan to implement a Remix.run route module according to the user's explanation.\n" +
      "You can use the Remix.run documentation for reference: `https://remix.run/docs/en/main`.\n" +
      "The React component you write can make use of Tailwind classes for styling.\n" +
      "If you need a UI component, icon, or utility function specify them.\n"
  );

  process.stdout.write("Designing the new remix.run route module...");
  const { routeDesign } = await processDesignStream(
    await designChat.sendMessages(
      "Components from `ui.shadcn.com` should be used to build the UI.\n" +
        "Icons from `lucide-react` can be used to build the UI.\n" +
        `ROUTE FILENAME: ${filename}\n` +
        "ROUTE DESCRIPTION:\n```" +
        description +
        "\n```\n\n" +
        "Design the new remix.run route module."
    )
  );
  if (!routeDesign) {
    throw new Error("No route design generated.");
  }

  let importsContext =
    "IMPORTS:\n" +
    "REMIX:\n```tsx\n" +
    'import type { RemixBrowserProps, ErrorResponse, Fetcher, FetcherWithComponents, FormEncType, FormMethod, FormProps, Location, NavigateFunction, Navigation, Params, Path, ShouldRevalidateFunction, ShouldRevalidateFunctionArgs, SubmitFunction, SubmitOptions, unstable_Blocker, unstable_BlockerFunction, AwaitProps, RemixNavLinkProps as NavLinkProps, RemixLinkProps as LinkProps, UIMatch, HtmlLinkDescriptor, MetaArgs, MetaDescriptor, MetaFunction, RouteModules as UNSAFE_RouteModules, RemixServerProps, FutureConfig as UNSAFE_FutureConfig, AssetsManifest as UNSAFE_AssetsManifest, RemixContextObject as UNSAFE_RemixContextObject, EntryRoute as UNSAFE_EntryRoute, RouteManifest as UNSAFE_RouteManifest } from "@remix-run/react";\n' +
    'import { RemixBrowser, createPath, generatePath, matchPath, matchRoutes, parsePath, resolvePath, Form, Outlet, useAsyncError, useAsyncValue, isRouteErrorResponse, useBeforeUnload, useFetchers, useFormAction, useHref, useLocation, useMatch, useNavigate, useNavigation, useNavigationType, useOutlet, useOutletContext, useParams, useResolvedPath, useRevalidator, useRouteError, useSearchParams, useSubmit, unstable_useBlocker, unstable_usePrompt, unstable_useViewTransitionState, Await, Meta, Links, Scripts, Link, NavLink, PrefetchPageLinks, LiveReload, useFetcher, useLoaderData, useRouteLoaderData, useActionData, useMatches, RemixContext as UNSAFE_RemixContext, ScrollRestoration, RemixServer } from "@remix-run/react";\n' +
    'import type { ActionFunction, ActionFunctionArgs, AppLoadContext, Cookie, CookieOptions, CookieParseOptions, CookieSerializeOptions, CookieSignatureOptions, DataFunctionArgs, EntryContext, ErrorResponse, HandleDataRequestFunction, HandleDocumentRequestFunction, HeadersArgs, HeadersFunction, HtmlLinkDescriptor, JsonFunction, LinkDescriptor, LinksFunction, LoaderFunction, LoaderFunctionArgs, MemoryUploadHandlerFilterArgs, MemoryUploadHandlerOptions, HandleErrorFunction, PageLinkDescriptor, RequestHandler, SerializeFrom, ServerBuild, ServerEntryModule, ServerRuntimeMetaArgs as MetaArgs, ServerRuntimeMetaDescriptor as MetaDescriptor, ServerRuntimeMetaFunction as MetaFunction, Session, SessionData, SessionIdStorageStrategy, SessionStorage, SignFunction, TypedDeferredData, TypedResponse, UnsignFunction, UploadHandler, UploadHandlerPart, } from "@remix-run/node";\n' +
    'import { installGlobals, createFileSessionStorage, unstable_createFileUploadHandler, NodeOnDiskFile, createCookie, createCookieSessionStorage, createMemorySessionStorage, createSessionStorage, createReadableStreamFromReadable, readableStreamToString, writeAsyncIterableToWritable, writeReadableStreamToWritable, createRequestHandler, createSession, defer, broadcastDevReady, logDevReady, isCookie, isSession, json, MaxPartSizeExceededError, redirect, redirectDocument, unstable_composeUploadHandlers, unstable_createMemoryUploadHandler, unstable_parseMultipartFormData, } from "@remix-run/node";\n' +
    "```\n";

  const openai = new OpenAI();

  let possibleIconsToUse = "";
  if (
    routeDesign.icons_to_use?.does_new_component_need_icons &&
    Array.isArray(routeDesign.icons_to_use.if_so_what_icons_are_needed) &&
    routeDesign.icons_to_use.if_so_what_icons_are_needed.length > 0
  ) {
    let iconsToUse = [];

    const iconsResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input: routeDesign.icons_to_use.if_so_what_icons_are_needed.join("\n"),
    });
    const iconsVector = iconsResponse?.data?.[0]?.embedding;
    if (!iconsVector) {
      throw new Error("Could not generate icons embedding.");
    }
    const iconsQueryResult = await lucidReactIndex.queryItems(
      iconsVector,
      routeDesign.icons_to_use.if_so_what_icons_are_needed.length
    );
    possibleIconsToUse = iconsQueryResult
      .map((result) => result.item.metadata.icon)
      .join(", ");
    // iconsToUse =
    //   routeDesign.icons_to_use.if_so_what_icons_are_needed.join(", ");
    importsContext += "ICONS:\n```tsx\n";
    importsContext += "import { ";
    importsContext += possibleIconsToUse;
    importsContext += " } from 'lucide-react';\n```\n";
  }

  let uiComponentsToUse = [];
  let examplesToSample = new Map();
  if (
    routeDesign.ui_components_to_use?.does_new_component_need_components &&
    Array.isArray(
      routeDesign.ui_components_to_use.if_so_what_components_are_needed
    ) &&
    routeDesign.ui_components_to_use.if_so_what_components_are_needed.length > 0
  ) {
    importsContext += "UI COMPONENTS:\n```tsx\n";

    const componentsResponse = await openai.embeddings.create({
      model: "text-embedding-ada-002",
      input:
        routeDesign.ui_components_to_use.if_so_what_components_are_needed.join(
          "\n"
        ),
    });
    const componentsVector = componentsResponse?.data?.[0]?.embedding;
    if (!componentsVector) {
      throw new Error("Could not generate components embedding.");
    }
    const componentsQueryResult = await chadcnUIIndex.queryItems(
      componentsVector,
      routeDesign.ui_components_to_use.if_so_what_components_are_needed.length
    );
    for (const result of componentsQueryResult) {
      const component = chadcnUIMetadata.components[result.item.metadata.name];
      if (!component) continue;
      importsContext += component.importStatement;
      uiComponentsToUse.push(result.item.metadata.name);

      if (
        Array.isArray(
          chadcnUIMetadata.examples.mappings[result.item.metadata.name]
        )
      ) {
        for (const example of chadcnUIMetadata.examples.mappings[
          result.item.metadata.name
        ]) {
          examplesToSample.set(
            example,
            chadcnUIMetadata.examples.sources[example]
          );
        }
      }
    }

    importsContext += "```\n";
  }
  importsContext += "\n";

  let examplesContext = "";
  const examples = Array.from(examplesToSample.values());
  let exampleTokens = 0;
  const examplesEnc = encoding_for_model("gpt-4-1106-preview");
  for (
    let i = 0;
    i < examples.length && exampleTokens < MAX_EXAMPLE_TOKENS;
    i++
  ) {
    if (!examplesContext) {
      examplesContext = "EXAMPLE COMPONENT USEAGE:\n```\n";
    }
    let example = examples[i];
    const exampleTokensLength = examplesEnc.encode(example).length;
    if (exampleTokens + exampleTokensLength > MAX_EXAMPLE_TOKENS) {
      example = example.slice(0, MAX_EXAMPLE_TOKENS - exampleTokens);
    }
    exampleTokens += exampleTokensLength;
    examplesContext += example + "\n";
  }
  if (examplesContext) {
    examplesContext += "```\n\n";
  }

  let questionContext = "";
  if (
    routeDesign.followup_questions
      ?.does_new_component_need_followup_questions &&
    Array.isArray(
      routeDesign.followup_questions.if_so_what_followup_questions_are_needed
    ) &&
    routeDesign.followup_questions.if_so_what_followup_questions_are_needed
      .length > 0
  ) {
    questionContext = "FOLLOWUP Q&A:\n";
    for (const question of routeDesign.followup_questions
      .if_so_what_followup_questions_are_needed) {
      const questionResult = await prompt({
        type: "input",
        multiline: true,
        name: "answer",
        message: question,
      });

      if (!questionResult?.answer) {
        continue;
      }
      questionContext += "Q: " + question + "\n";
      questionContext += "A: " + questionResult.answer + "\n";
    }
    questionContext += "\n";
  }

  let readyToGenerate = null;
  while (!readyToGenerate?.confirm) {
    console.log("Request:\n" + description + "\n");
    console.log(
      "Route Component Name:\n" + routeDesign.new_route_component_name + "\n"
    );
    console.log(
      "Needs Loader:\n" +
        (routeDesign.does_new_route_need_loader ? "yes" : "no") +
        "\n"
    );
    console.log(
      "Needs Action:\n" +
        (routeDesign.does_new_route_need_action ? "yes" : "no") +
        "\n"
    );
    console.log(
      "Route Description:\n" + routeDesign.new_route_module_description + "\n"
    );
    if (possibleIconsToUse) {
      console.log("Icons To Use:\n" + possibleIconsToUse + "\n");
    }
    if (uiComponentsToUse.length > 0) {
      console.log("Components To Use:\n" + uiComponentsToUse.join(", ") + "\n");
    }
    if (questionContext) {
      console.log("Followup Questions:\n" + questionContext + "\n");
    }

    readyToGenerate = await prompt({
      type: "confirm",
      name: "confirm",
      message: "Proceed to generate the new route module?",
    });

    if (!readyToGenerate?.confirm) {
      const answer = await prompt({
        type: "input",
        multiline: true,
        name: "response",
        message: "What additional context would be useful?",
      });
      if (answer?.response) {
        if (!questionContext) {
          questionContext = "FOLLOWUP Q&A:\n";
        }
        questionContext += "Q: What additional context would be useful?\n";
        questionContext += "A: " + answer.response + "\n";
      }
    }
  }

  const generateChat = new ChatManager();
  generateChat.addSystemMessages(
    `You are an expert at writing Remix.run applications.\n` +
      `Your task is to write a new Remix.run route module for a web app, according to the provided task details.\n` +
      `The default export Remix route component you write can make use of Tailwind classes for styling.\n` +
      `If you judge it is relevant to do so, you can use library components and icons.\n\n` +
      `You will write the full Remix route module component code, loader, and action, which should include all imports.` +
      `Your generated code will be directly written to a .tsx React component file and used in production.`
  );

  console.log("Generating the new route module...");
  const { code } = await processGenerateStream(
    await generateChat.sendMessages(
      "THEMING AND STYLING REFERENCE DOCS:\n" +
        `You can choose between using CSS variables or Tailwind CSS utility classes for theming.

## Utility classes

\`\`\`tsx /bg-zinc-950/ /text-zinc-50/ /dark:bg-white/ /dark:text-zinc-950/
<div className="bg-zinc-950 dark:bg-white" />
\`\`\`

To use utility classes for theming set \`tailwind.cssVariables\` to \`false\` in your \`components.json\` file.

\`\`\`json {8} title="components.json"
{
  "style": "default",
  "rsc": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": false
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
\`\`\`

## CSS Variables

\`\`\`tsx /bg-background/ /text-foreground/
<div className="bg-background text-foreground" />
\`\`\`

To use CSS variables for theming set \`tailwind.cssVariables\` to \`true\` in your \`components.json\` file.

\`\`\`json {8} title="components.json"
{
  "style": "default",
  "rsc": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
\`\`\`

### Convention

We use a simple \`background\` and \`foreground\` convention for colors. The \`background\` variable is used for the background color of the component and the \`foreground\` variable is used for the text color.

<Callout className="mt-4">

The \`background\` suffix is omitted when the variable is used for the background color of the component.

</Callout>

Given the following CSS variables:

\`\`\`css
--primary: 222.2 47.4% 11.2%;
--primary-foreground: 210 40% 98%;
\`\`\`

The \`background\` color of the following component will be \`hsl(var(--primary))\` and the \`foreground\` color will be \`hsl(var(--primary-foreground))\`.

\`\`\`tsx
<div className="bg-primary text-primary-foreground">Hello</div>
\`\`\`

<Callout>

**CSS variables must be defined without color space function**. See the [Tailwind CSS documentation](https://tailwindcss.com/docs/customizing-colors#using-css-variables) for more information.

</Callout>

### List of variables

Here's the list of variables available for customization:

<Steps>

\`\`\`css title="Default background color of <body />...etc"
--background: 0 0% 100%;
--foreground: 222.2 47.4% 11.2%;
\`\`\`

\`\`\`css title="Muted backgrounds such as <TabsList />, <Skeleton /> and <Switch />"
--muted: 210 40% 96.1%;
--muted-foreground: 215.4 16.3% 46.9%;
\`\`\`

\`\`\`css title="Background color for <Card />"
--card: 0 0% 100%;
--card-foreground: 222.2 47.4% 11.2%;
\`\`\`

\`\`\`css title="Background color for popovers such as <DropdownMenu />, <HoverCard />, <Popover />"
--popover: 0 0% 100%;
--popover-foreground: 222.2 47.4% 11.2%;
\`\`\`

\`\`\`css title="Default border color"
--border: 214.3 31.8% 91.4%;
\`\`\`

\`\`\`css title="Border color for inputs such as <Input />, <Select />, <Textarea />"
--input: 214.3 31.8% 91.4%;
\`\`\`

\`\`\`css title="Primary colors for <Button />"
--primary: 222.2 47.4% 11.2%;
--primary-foreground: 210 40% 98%;
\`\`\`

\`\`\`css title="Secondary colors for <Button />"
--secondary: 210 40% 96.1%;
--secondary-foreground: 222.2 47.4% 11.2%;
\`\`\`

\`\`\`css title="Used for accents such as hover effects on <DropdownMenuItem>, <SelectItem>...etc"
--accent: 210 40% 96.1%;
--accent-foreground: 222.2 47.4% 11.2%;
\`\`\`

\`\`\`css title="Used for destructive actions such as <Button variant="destructive">"
--destructive: 0 100% 50%;
--destructive-foreground: 210 40% 98%;
\`\`\`

\`\`\`css title="Used for focus ring"
--ring: 215 20.2% 65.1%;
\`\`\`

\`\`\`css title="Border radius for card, input and buttons"
--radius: 0.5rem;
\`\`\`

</Steps>`,
      "ORIGINAL DESCRIPTION:\n```\n" +
        description +
        "\n```\n\n" +
        `COMPONENT NAME: ${routeDesign.new_route_component_name}\n` +
        `ROUTE MODULE NEEDS LOADER: ${
          routeDesign.does_new_route_need_loader ? "yes" : "no"
        }\n` +
        `ROUTE MODULE NEEDS ACTION: ${
          routeDesign.does_new_route_need_action ? "yes" : "no"
        }\n` +
        "ROUTE MODULE DESCRIPTION:\n```\n" +
        routeDesign.new_route_module_description +
        "\n```\n\n" +
        questionContext +
        importsContext +
        examplesContext +
        "ROUTE MODULE OUTLINE:\n```tsx\n" +
        `import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";

export async function loader({}: LoaderFunctionArgs) {
  return json({ });
}

export async function action({}: ActionFunctionArgs) {
  return json({ });
}

export default function ${routeDesign.new_route_component_name}() {
  const actionData = useActionData<typeof action>();
  const loaderData = useLoaderData<typeof loader>();

  // TODO: Implement the ${routeDesign.new_route_component_name} component
}
` +
        "```\n\n" +
        "The full code of the new Remix route module that you write will be written directly to a .tsx file inside the Remix projects routes directory. Make sure all necessary imports are done, and that your full code is enclosed with ```tsx blocks.\n" +
        "Answer with generated code only. DO NOT ADD ANY EXTRA TEXT DESCRIPTION OR COMMENTS BESIDES THE CODE. Your answer contains code only ! component code only !\n" +
        `Important :\n` +
        `- Only use imports provided above, do not add aditional imports !\n` +
        `- All inputs should be uncontrolled and *not* rely on local state !\n` +
        `- All inputs should have a name attribute !\n` +
        `- Tailwind classes should be written directly in the elements class tags (or className in case of React). DO NOT WRITE ANY CSS OUTSIDE OF CLASSES. DO NOT USE ANY <style> IN THE CODE ! CLASSES STYLING ONLY !\n` +
        `- Do not use libraries or imports except what is provided in this task; otherwise it would crash the component because not installed. Do not import extra libraries besides what is provided above !\n` +
        `$- Very important : Your component should be exported as default !\n` +
        `$- Very important : loaders and actions should ALWAYS be declared as a normal async function declaration, NEVER as an arrow function !\n` +
        "Write the Remix route module as the creative genius and React component genius you are - with good ui formatting."
    )
  );

  // code is contained within an "```tsx" and "```" block
  const codeToWriteToDisk = code.trim().slice(5, -3);
  const { confirm } = await prompt({
    type: "confirm",
    name: "confirm",
    message:
      "Proceed to write the new route module to disk at " + filename + "?",
  });

  if (!confirm) {
    throw new Error("User cancelled.");
  }

  await fsp.writeFile(
    path.join("app/routes", filename),
    codeToWriteToDisk,
    "utf8"
  );
}

async function processDesignStream(stream) {
  let aiResponse = "";
  let routeDesign = null;
  for await (const chunk of stream) {
    process.stdout.write(".");
    if ("function" in chunk) {
      if (chunk.function === "designNewRouteModule") {
        routeDesign = chunk.result;
      }
      if (chunk.function === "askQuestion") {
        aiResponse = chunk.result;
      }
    }
  }
  process.stdout.write("\n");

  return {
    aiResponse,
    routeDesign,
  };
}

async function processGenerateStream(stream) {
  let code = "";

  for await (const chunk of stream) {
    if ("message" in chunk) {
      process.stdout.write(chunk.message);
      code += chunk.message;
    }
  }
  process.stdout.write("\n");

  return { code };
}
