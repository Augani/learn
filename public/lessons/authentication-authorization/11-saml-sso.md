# Lesson 11: SAML & Enterprise SSO

> **The one thing to remember**: SAML (Security Assertion Markup
> Language) is the enterprise standard for single sign-on. It lets
> employees log in once to their company's identity provider and
> access dozens of apps without signing in again. Think of it as
> your company badge that opens every door in every building.

---

## The Corporate Campus Analogy

```
SINGLE SIGN-ON IS LIKE A CORPORATE CAMPUS

  WITHOUT SSO:
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Building A   │  │ Building B   │  │ Building C   │
  │ (Salesforce) │  │ (Slack)      │  │ (Jira)       │
  │              │  │              │  │              │
  │ Show ID      │  │ Show ID      │  │ Show ID      │
  │ Sign in      │  │ Sign in      │  │ Sign in      │
  │ again        │  │ again        │  │ again        │
  └──────────────┘  └──────────────┘  └──────────────┘
  You carry 3 different badges and sign in 3 times.

  WITH SSO:
  ┌──────────────────────────────────────────────────┐
  │                SECURITY DESK (IdP)               │
  │    Show ID once → Get a universal badge          │
  └──────┬────────────────┬────────────────┬─────────┘
         │                │                │
         ▼                ▼                ▼
  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
  │ Building A   │  │ Building B   │  │ Building C   │
  │ Badge works! │  │ Badge works! │  │ Badge works! │
  └──────────────┘  └──────────────┘  └──────────────┘
  You sign in ONCE. The badge works everywhere.
```

---

## SAML Roles

SAML defines two primary roles:

```
SAML ROLES

  IDENTITY PROVIDER (IdP)
  ┌─────────────────────────────────────────────┐
  │ The system that knows who users are.        │
  │ Handles authentication.                     │
  │                                             │
  │ Examples:                                   │
  │   - Okta                                    │
  │   - Azure Active Directory                  │
  │   - OneLogin                                │
  │   - Google Workspace                        │
  │   - PingFederate                            │
  │                                             │
  │ Your company runs ONE IdP for all employees.│
  └─────────────────────────────────────────────┘

  SERVICE PROVIDER (SP)
  ┌─────────────────────────────────────────────┐
  │ The application the user wants to access.   │
  │ Relies on the IdP for authentication.       │
  │                                             │
  │ Examples:                                   │
  │   - Salesforce                              │
  │   - Slack                                   │
  │   - AWS Console                             │
  │   - Jira / Confluence                       │
  │   - Your internal apps                      │
  │                                             │
  │ Each app is an SP that trusts the IdP.      │
  └─────────────────────────────────────────────┘

  MAPPING TO OAUTH TERMS:
  IdP ≈ Authorization Server (but for identity)
  SP  ≈ Client / Relying Party
```

---

## How SAML Works: SP-Initiated Flow

The most common flow — the user starts at the app (SP):

```
SP-INITIATED SAML FLOW

  User            Service Provider       Identity Provider
  (Browser)       (Slack)                (Okta)
  ───────         ────────────────       ─────────────────
     │                  │                       │
     │ 1. Go to         │                       │
     │ slack.com/login   │                       │
     │─────────────────►│                       │
     │                  │                       │
     │                  │ 2. "I don't know this  │
     │                  │ user. Redirect to IdP" │
     │                  │                       │
     │ 3. Redirect to Okta with SAML AuthnRequest│
     │◄─────────────────│                       │
     │                  │                       │
     │ 4. Browser follows redirect              │
     │──────────────────────────────────────────►│
     │                  │                       │
     │ 5. Okta login page                       │
     │◄─────────────────────────────────────────│
     │                  │                       │
     │ 6. Enter credentials (or already logged in)
     │──────────────────────────────────────────►│
     │                  │                       │
     │                  │  7. Okta creates a    │
     │                  │  SAML Assertion:      │
     │                  │  "Alice is authentic, │
     │                  │   email: alice@co.com │
     │                  │   role: engineering"  │
     │                  │  Signed with Okta's   │
     │                  │  private key.         │
     │                  │                       │
     │ 8. POST to Slack's ACS endpoint          │
     │ (with SAML Response in form body)        │
     │◄─────────────────────────────────────────│
     │                  │                       │
     │ 9. Browser auto-submits form to Slack    │
     │─────────────────►│                       │
     │                  │                       │
     │                  │ 10. Slack verifies     │
     │                  │ assertion signature    │
     │                  │ using Okta's public    │
     │                  │ key (pre-configured)   │
     │                  │                       │
     │                  │ 11. Create session     │
     │                  │ for alice@company.com  │
     │                  │                       │
     │ 12. Welcome!     │                       │
     │◄─────────────────│                       │
```

**The key insight**: At step 6, if the user is already logged into
Okta (from accessing another app earlier), they skip the login form
entirely. This is the "single sign-on" experience — log in once at
the IdP, and every SP just works.

---

## IdP-Initiated Flow

Less common — the user starts at the IdP's app dashboard:

```
IdP-INITIATED FLOW

  User sees their Okta dashboard:
  ┌─────────────────────────────────────┐
  │  Your Apps                          │
  │                                     │
  │  [Slack]  [Salesforce]  [Jira]      │
  │  [AWS]    [GitHub]      [Zoom]      │
  └─────────────────────────────────────┘

  User clicks "Slack":
  1. Okta creates a SAML Assertion immediately
     (user is already authenticated at Okta)
  2. Browser POSTs assertion to Slack's ACS endpoint
  3. Slack validates and creates session

  No AuthnRequest needed — the IdP initiates the flow.

  SECURITY NOTE: IdP-initiated flows are more vulnerable
  to replay attacks because there's no request to tie the
  response to. SP-initiated is preferred.
```

---

## SAML Assertions

The SAML assertion is an XML document containing identity claims:

```
SAML ASSERTION (simplified structure)

  <saml:Assertion>
    <saml:Issuer>https://okta.company.com</saml:Issuer>

    <ds:Signature>
      <!-- XML Digital Signature proving this came from Okta -->
    </ds:Signature>

    <saml:Subject>
      <saml:NameID>alice@company.com</saml:NameID>
    </saml:Subject>

    <saml:Conditions
      NotBefore="2024-01-15T10:00:00Z"
      NotOnOrAfter="2024-01-15T10:05:00Z">
      <saml:AudienceRestriction>
        <saml:Audience>https://slack.com/saml</saml:Audience>
      </saml:AudienceRestriction>
    </saml:Conditions>

    <saml:AuthnStatement
      AuthnInstant="2024-01-15T09:55:00Z">
      <!-- When and how the user authenticated -->
    </saml:AuthnStatement>

    <saml:AttributeStatement>
      <saml:Attribute Name="email">
        <saml:AttributeValue>alice@company.com</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="firstName">
        <saml:AttributeValue>Alice</saml:AttributeValue>
      </saml:Attribute>
      <saml:Attribute Name="role">
        <saml:AttributeValue>engineering</saml:AttributeValue>
      </saml:Attribute>
    </saml:AttributeStatement>
  </saml:Assertion>
```

The assertion is digitally signed by the IdP. The SP verifies the
signature using the IdP's public key (configured during setup).

---

## SAML vs OIDC

```
COMPARISON

  ┌────────────────────┬──────────────────┬──────────────────┐
  │ Feature            │ SAML 2.0         │ OpenID Connect   │
  ├────────────────────┼──────────────────┼──────────────────┤
  │ Year               │ 2005             │ 2014             │
  │ Format             │ XML              │ JSON (JWT)       │
  │ Transport          │ Browser POST     │ HTTP redirects   │
  │ Token size         │ Large (XML)      │ Small (JWT)      │
  │ Mobile support     │ Poor             │ Good             │
  │ API integration    │ Awkward          │ Native           │
  │ Complexity         │ High             │ Moderate         │
  │ Enterprise adoption│ Dominant         │ Growing          │
  │ Library support    │ Mature           │ Very mature      │
  │ Discovery          │ Metadata XML     │ JSON discovery   │
  └────────────────────┴──────────────────┴──────────────────┘

  WHEN TO USE WHICH:

  SAML:
  - Your customers are enterprises with existing IdPs
  - You need to integrate with Okta, ADFS, PingFederate
  - The requirement says "SAML" (many enterprise RFPs do)

  OIDC:
  - New applications, modern architecture
  - Mobile apps or SPAs
  - API-first design
  - Social login (Google, GitHub, etc.)
  - When you have a choice

  BOTH:
  - Many enterprise apps support both
  - IdPs like Okta and Azure AD support both
```

---

## Why Enterprises Use SAML

Despite being older and more complex, SAML dominates enterprise SSO:

```
ENTERPRISE REQUIREMENTS

  1. CENTRALIZED IDENTITY MANAGEMENT
     IT admin adds/removes users in ONE place (the IdP).
     When someone leaves the company, disable their IdP account
     and they lose access to ALL apps instantly.

  2. COMPLIANCE
     SAML provides detailed assertion logs.
     "Who accessed what, when, how they authenticated."
     Required for SOC 2, HIPAA, FedRAMP.

  3. EXISTING INFRASTRUCTURE
     Most enterprises already have Active Directory or Okta.
     These have been doing SAML for 15+ years.
     Switching costs are enormous.

  4. FEDERATION
     Company A's employees can access Company B's apps
     without creating new accounts. The IdPs talk to each other.

  5. ATTRIBUTE MAPPING
     IdP sends role, department, and permissions in the assertion.
     The SP doesn't need its own user management — it trusts
     whatever the IdP says about the user.
```

---

## Setting Up SAML (As the SP)

If you're building a SaaS app and an enterprise customer wants SAML:

```
SAML CONFIGURATION EXCHANGE

  Your app (SP) provides to the customer:
  ┌─────────────────────────────────────────────┐
  │ ACS URL:     https://yourapp.com/saml/acs   │
  │ Entity ID:   https://yourapp.com/saml       │
  │ (Sometimes called "Audience URI")            │
  └─────────────────────────────────────────────┘

  Customer's IdP provides to you:
  ┌─────────────────────────────────────────────┐
  │ SSO URL:     https://idp.customer.com/saml  │
  │ Entity ID:   https://idp.customer.com       │
  │ Certificate: (X.509 public certificate)     │
  │ (Used to verify assertion signatures)        │
  └─────────────────────────────────────────────┘

  You exchange this information, configure both sides,
  and SAML SSO works. Each enterprise customer has their
  own IdP configuration in your app.
```

```python
from onelogin.saml2.auth import OneLogin_Saml2_Auth

saml_settings = {
    "sp": {
        "entityId": "https://yourapp.com/saml",
        "assertionConsumerService": {
            "url": "https://yourapp.com/saml/acs",
            "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
        }
    },
    "idp": {
        "entityId": "https://idp.customer.com",
        "singleSignOnService": {
            "url": "https://idp.customer.com/saml/sso",
            "binding": "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect"
        },
        "x509cert": "MIICpDCCAYwCCQD..."
    }
}

@app.route("/saml/login")
def saml_login():
    auth = OneLogin_Saml2_Auth(request, saml_settings)
    return redirect(auth.login())

@app.route("/saml/acs", methods=["POST"])
def saml_acs():
    auth = OneLogin_Saml2_Auth(request, saml_settings)
    auth.process_response()

    if auth.get_errors():
        return f"SAML Error: {auth.get_errors()}", 400

    user_email = auth.get_nameid()
    attributes = auth.get_attributes()
    user_role = attributes.get("role", ["user"])[0]

    session["user"] = {
        "email": user_email,
        "role": user_role,
        "saml_session": auth.get_session_index()
    }
    return redirect("/dashboard")
```

---

## SAML Security Considerations

```
SAML SECURITY CHECKLIST

  ✓ Always validate the assertion signature
  ✓ Check NotBefore and NotOnOrAfter conditions
  ✓ Verify the Audience matches your SP Entity ID
  ✓ Check the Issuer matches the expected IdP
  ✓ Use HTTPS for all SAML endpoints
  ✓ Protect against XML signature wrapping attacks
    (use well-tested libraries, never parse SAML XML manually)
  ✓ Implement single logout (SLO) if required
  ✓ Validate the InResponseTo field (for SP-initiated flows)
```

**XML Signature Wrapping** is a class of attacks specific to SAML
where an attacker manipulates the XML structure to make the signature
verify against one part of the document while the application reads
a different (attacker-controlled) part. This is why you should never
implement SAML XML parsing yourself — always use a well-tested library.

---

## Exercises

1. **Map the flow**: Draw the SP-initiated SAML flow for this
   scenario: An employee at Acme Corp opens their browser, goes to
   salesforce.com, and Acme uses Okta as their IdP. Label every
   redirect and POST.

2. **Compare formats**: Look up a real SAML assertion XML and a
   real OIDC ID token JWT. Compare the size, readability, and
   the information conveyed. Which would you prefer to debug?

3. **Enterprise scenario**: A potential customer says "We require
   SAML SSO for our 5,000 employees. We use Azure AD." What
   information do you need from them? What do they need from you?
   What library would you use in your language?

4. **Single Logout**: Research SAML Single Logout (SLO). When an
   employee logs out of one SP, they should be logged out of ALL
   SPs. Draw the flow. What are the challenges of making this work
   reliably?

---

[Next: Lesson 12 — Role-Based Access Control](./12-rbac.md)
