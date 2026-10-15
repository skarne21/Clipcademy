# Readme-startup4.md: Clear expansion

## What YC verifies

[Y Combinator describes Clear](https://www.ycombinator.com/companies/clear) as a free mobile app where people track skincare routines, products, and selfies, get brand-agnostic recommendations, and learn from a community. Its Premium tier adds routine analytics, product and ingredient comparisons, and product scanning. The company says it is building an AI and data platform on top of this tracking data. The routine builder below is a **proposed expansion**, not a feature attributed to Clear.

## Proposed idea: A routine builder that checks itself

Let a user scan or log the products they already own, describe their skin goals, and receive a written morning and evening routine using those products. Each routine explains the order of steps, how often to use each product, and which products should not be used together. The scope is cosmetic routines only; it does not diagnose or treat skin conditions.

### 1. Solves one problem extremely well

The focused problem is that people own a shelf of products and don't know how to combine them. Using the wrong order or stacking harsh ingredients can irritate skin and waste money. The product would do one thing consistently: turn the products someone already has into a safe, ordered routine.

### 2. Knows or can reach target customers

The target customers are people who already buy several skincare products and follow routines from social media. **Direct customer access has not been established.** Interviews and small trials with college students who use multiple products would test how often they are unsure about order and combinations, and whether they would trust a generated routine.

### 3. Uses manageable infrastructure

The platform needs a product catalog with ingredient lists, a scanner or search tool, an LLM service, a rules table for ingredient combinations and step order, user routine records, and a mobile interface. The rules table needs review by a dermatologist or cosmetic chemist before launch. The plan does not assume access to Clear's code, data, or existing infrastructure.

### 4. Meaningfully reimagines the experience

Most skincare advice starts with "buy this." This starts with what the user already owns and tells them how to use it. As the user logs their routine and progress photos over time, the routine could be adjusted, so the advice responds to their results instead of generic rules.

### 5. Makes generative AI core to the solution

The model writes the routine itself: it picks which owned products to include, orders them, sets frequency, and explains each choice in plain language tied to the user's goals. It also rewrites the routine when the user adds or removes a product. Without generation, the user would get a list of rules instead of a routine built for them.

### 6. Validates every generated user-facing artifact

No generated routine, explanation, or adjustment reaches the user before server-side validation. Checks confirm that every product named exists in the user's logged list, ingredient pairs flagged as conflicting in the rules table are not scheduled together, steps follow the approved order (for example, sunscreen last in the morning), frequencies stay within set limits for strong actives, and the text makes no medical or treatment claims. If a product's ingredients are missing from the catalog, the routine cannot include it.

### 7. Automatically corrects validation failures

The validator returns specific errors, such as "retinol and glycolic acid scheduled the same night" or "product not in user's list," to the model, which revises the routine and submits it again. The process has a retry limit. If the routine still fails, the user receives a simpler routine built only from rule-approved steps, or a message suggesting they check with a dermatologist. A failed routine is never shown.

### 8. Can be fully deployed

A deployable version would include accounts, a product catalog and scanner, generation and validation services, routine history, monitoring, and a way to report bad advice. More product categories and ingredient rules could be added as they are reviewed. This is a deployment plan for the proposed expansion, not a claim that the product or its customer demand has already been established.
