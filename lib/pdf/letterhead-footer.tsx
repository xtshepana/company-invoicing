import { Text, View } from "@react-pdf/renderer";
import { PhoneIcon, MailIcon, GlobeIcon } from "@/lib/pdf/icons";
import type { CompanySettings } from "@/lib/config/system-settings";

interface LetterheadFooterProps {
  settings: CompanySettings;
  position: { bottom: number; left: number; right: number };
  lineColor?: string;
  textColor?: string;
  fontFamily?: string;
  italicFontFamily?: string;
}

/**
 * Shared letterhead-style footer: a rule, an optional footer note, a row
 * of phone/email/website each with a small icon, then the company name -
 * used across every PDF template so the footer looks consistent even
 * though each template otherwise styles itself independently.
 */
export function LetterheadFooter({
  settings,
  position,
  lineColor = "#e5e5e5",
  textColor = "#888888",
  fontFamily,
  italicFontFamily,
}: LetterheadFooterProps) {
  const contactItems: { key: string; icon: React.ReactElement; value: string }[] = [];
  if (settings.phone) contactItems.push({ key: "phone", icon: <PhoneIcon color={textColor} />, value: settings.phone });
  if (settings.email) contactItems.push({ key: "email", icon: <MailIcon color={textColor} />, value: settings.email });
  if (settings.website) contactItems.push({ key: "website", icon: <GlobeIcon color={textColor} />, value: settings.website });

  return (
    <View
      style={{
        position: "absolute",
        bottom: position.bottom,
        left: position.left,
        right: position.right,
        borderTop: `0.75px solid ${lineColor}`,
        paddingTop: 8,
        alignItems: "center",
      }}
      fixed
    >
      {settings.default_invoice_footer ? (
        <Text
          style={{
            fontSize: 7.5,
            color: textColor,
            fontFamily: italicFontFamily ?? fontFamily,
            marginBottom: 5,
            textAlign: "center",
          }}
        >
          {settings.default_invoice_footer}
        </Text>
      ) : null}
      {contactItems.length > 0 ? (
        <View style={{ flexDirection: "row", justifyContent: "center", marginBottom: settings.show_company_name ? 4 : 0 }}>
          {contactItems.map((item, index) => (
            <View key={item.key} style={{ flexDirection: "row", alignItems: "center", marginLeft: index === 0 ? 0 : 16 }}>
              {item.icon}
              <Text style={{ fontSize: 7.5, color: textColor, fontFamily, marginLeft: 4 }}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {settings.show_company_name ? (
        <Text style={{ fontSize: 7, color: textColor, fontFamily: italicFontFamily ?? fontFamily, textAlign: "center" }}>
          {settings.company_name}
        </Text>
      ) : null}
    </View>
  );
}
