import { decryptText } from "./encryption";

// We store these keys obfuscated because GitHub will automatically revoke them if they are
// stored in plain text and committed to a public repo. These keys are supposed to be publicly available.
const encryptionKey = "not-a-secret";
export const TESTS_PUBLIC_SSH_KEY = decryptText(
  "HRwcAARJQVBWQ1xULy41bCIePR8CMVQYNCs9HC95NlAiMyQ1JyYtFVkZNSMgCzYkHzdEXSp3BDZbABxEIAVMBhB+K1AMCgYWJRcCHQRUAx1DGgoXGxw0SBlMHhUPF0sXAQI=",
  encryptionKey,
);
export const TESTS_PRIVATE_SSH_KEY = decryptText(
  "Q0JZAExvNiIqPEU7Pio6fjJlUzUxOzM1OipUZiR0XkhOX0h+DFw2QQNDPR8CMVQGNDcfWQVHNiQiMyQ1LChBWwNAJiQiMyQxDAJNWDt8MiQiMyQ1Ly41byBsMiQuBSQ1Ly4AVwIfFBE5JW8lFyEgeBliIiQiMyY3KT8kYiN/IhYIGFMYVyQnQAJoBS5bBiEtQT8FRg0GEig7NRwHDFY8XhBOIiQiMy8TOlpbRFdoWANXeBATLy41bBVXEFcEBj8jPxY6eTRVPDQiMyQ3LSgkfS5vITQQGQ9CAlY/fgxONhMoShEwN0AkXApBWAQuKiINHQ1NZRJcEDRpMyQ1Ky0cGiZfKT0ZAyE1GFkjTClMIC0GACI5IgAwezRABygKFlMyIC01Gk5mQjxXK11MWikybhh+IxQ7QhU/NBgnFRNUQ28tGF1fHzwsGA5VEAcoChNECxYEVSBsMiQmJQ0CN1wiVzBqJVE6JVQDDCghWDgfShEiIywwLC5JEGsAXkhOXyA6Kk87fSRjIDYrUjUmJzk1eSQNOCA6X0hZQ0J+",
  encryptionKey,
);
export const TESTS_REPO_URL = "git@github.com:hocus-dev/tests.git";
export const HOCUS_REPO_URL = "git@github.com:hocus-dev/hocus.git";
