import * as fs from "fs";
import * as handlebars from "handlebars";
import * as path from "path";

export function renderTemplate(templateName: string, data: any): string {
  const filePath = path.join(process.cwd(), "src", "templates", `${templateName}.hbs`);

  const templateSource = fs.readFileSync(filePath, "utf8");

  const template = handlebars.compile(templateSource);

  return template(data);
}
