# Firebase Auth — branded verification email

Firebase sends password‑provider verification messages using the template in **Firebase Console → Authentication → Templates → Email address verification**.

The app cannot change that HTML from this repository; paste the markup below into the console so the message matches **Paystack.ch** (dark shell, Geneva red `#E8423F`, Swiss‑facing typography).

## Subject (English)

`Verify your email — Paystack.ch`

## Subject (optional French variant)

Use the same template body with this subject if your project is FR‑first:

`Confirmez votre e-mail — Paystack.ch`

## HTML body

Use the **HTML** editor in Firebase. The only substitution Firebase provides for this template is **`%LINK%`** (and `%EMAIL%` where supported). Do not remove `%LINK%` from the button and fallback text.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="x-ua-compatible" content="ie=edge">
<title>Verify your email</title>
</head>
<body style="margin:0;padding:0;background-color:#160f12;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#160f12;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background-color:#1f161a;border:1px solid #4a2a31;border-radius:14px;">
          <tr>
            <td style="padding:36px 32px;">
              <p style="margin:0 0 10px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:11px;font-weight:800;letter-spacing:0.22em;text-transform:uppercase;color:#e8423f;text-align:center;">Paystack.ch</p>
              <h1 style="margin:0 0 18px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:22px;font-weight:800;color:#f7f3f4;text-transform:uppercase;letter-spacing:0.06em;text-align:center;line-height:1.2;">Verify your email</h1>
              <p style="margin:0 0 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.55;color:#c6aeb0;text-align:center;">Tap the button below to confirm your address and continue with your Swiss financial workspace.</p>
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:6px;background-color:#e8423f;">
                    <a href="%LINK%" style="display:inline-block;padding:15px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:13px;font-weight:800;color:#ffffff;text-transform:uppercase;letter-spacing:0.1em;text-decoration:none;">Verify email</a>
                  </td>
                </tr>
              </table>
              <p style="margin:28px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.55;color:#c6aeb0;text-align:center;"><strong style="color:#f7f3f4;">Spam or Promotions?</strong><br />If you do not see this message in your inbox, check your spam or promotions folder — verifications often land there first.</p>
              <p style="margin:22px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:12px;line-height:1.5;color:#8a7578;text-align:center;">If the button does not work, copy this link into your browser:</p>
              <p style="margin:8px 0 0;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;word-break:break-all;color:#e8423f;text-align:center;">%LINK%</p>
              <p style="margin:26px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:11px;line-height:1.45;color:#6f6669;text-align:center;">You received this because someone created a Paystack.ch account with this email. If that was not you, you can ignore this message.</p>
            </td>
          </tr>
        </table>
        <p style="margin:28px 16px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:11px;color:#6f6669;text-align:center;">Swiss financial management · Geneva</p>
      </td>
    </tr>
  </table>
</body>
</html>
```

After saving, send yourself a test verification from the app and confirm rendering in Gmail / Outlook.
