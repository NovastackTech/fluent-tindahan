using System.Text;

namespace FluentTindahan.WebApi.Controllers.Helpers;

/// <summary>
/// Provides Unicode NFKC normalization, invisible character stripping, and canonical lowercasing for email addresses.
/// </summary>
public static class AuthEmailNormalizer
{
    /// <summary>
    /// Cleans an email for display: applies Unicode NFKC normalization, removes invisible
    /// control/zero-width formatting characters, and trims Unicode whitespace. Preserves original letter case.
    /// </summary>
    public static string CleanDisplayEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return string.Empty;
        }

        var normalized = email.Normalize(NormalizationForm.FormKC);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            // Strip zero-width, bidirectional formatting, and invisible control characters:
            // \u200B: zero-width space
            // \u200C: zero-width non-joiner
            // \u200D: zero-width joiner
            // \uFEFF: zero-width no-break space (BOM)
            // \u200E / \u200F: left-to-right / right-to-left marks
            if (ch == '\u200B' ||
                ch == '\u200C' ||
                ch == '\u200D' ||
                ch == '\uFEFF' ||
                ch == '\u200E' ||
                ch == '\u200F' ||
                char.IsControl(ch))
            {
                continue;
            }

            sb.Append(ch);
        }

        return sb.ToString().Trim();
    }

    /// <summary>
    /// Normalizes an email address using Unicode NFKC normalization, stripping invisible
    /// control/zero-width formatting characters, trimming Unicode whitespace, and converting to invariant lowercase.
    /// Used for unique indexing and collision-free identity lookup.
    /// </summary>
    public static string NormalizeEmail(string? email)
    {
        return CleanDisplayEmail(email).ToLowerInvariant();
    }

    private static readonly HashSet<string> DisposableDomains = new(StringComparer.OrdinalIgnoreCase)
    {
        "10minutemail.com", "10minutemail.net", "10minutemail.org", "20minutemail.com",
        "33mail.com", "anonaddy.com", "anonaddy.me", "bccto.me", "binkmail.com",
        "bobmail.info", "burnermail.io", "chacuo.net", "chammy.info", " cock.li",
        "crazymailing.com", "deadaddress.com", "despam.it", "devnullmail.com",
        "discard.email", "discardmail.com", "discardmail.de", "dispostable.com",
        "dodgeit.com", "dodgit.com", "drdrb.net", "dropmail.me", "duck.com",
        "dump-email.info", "e4ward.com", "emailondeck.com", "emailtemporanea.com",
        "emailtemporanea.net", "emailtemporario.com.br", "ephemail.net",
        "explodemail.com", "fakeinbox.com", "fakemail.fr", "fakemailgenerator.com",
        "fastacura.com", "filzmail.com", "fizmail.com", "fleckens.hu", "frapmail.com",
        "garliclife.com", "Generator.email", "generator.email", "getairmail.com",
        "getnada.com", "getonemail.com", "getonemail.net", "gishpuppy.com",
        "Grandmamail.com", "grr.la", "guerrillamail.biz", "guerrillamail.com",
        "guerrillamail.de", "guerrillamail.info", "guerrillamail.net", "guerrillamail.org",
        "guerrillamailblock.com", "harakirimail.com", "hmamail.com", "incognitomail.com",
        "incognitomail.net", "incognitomail.org", "inboxalias.com", "inboxbear.com",
        "inboxclean.com", "inboxclean.org", "inboxkitten.com", "instant-mail.de",
        "ipoo.org", "irish2me.com", "jetable.com", "jetable.fr.nf", "jetable.net",
        "jetable.org", "junk1e.com", "kasmail.com", "kaspop.com", "klzlk.com",
        "kulturbetrieb.info", "kurzepost.de", "letthemeatspam.com", "lhsdv.com",
        "lifebyfood.com", "link2mail.net", "litedrop.com", "lol.ovpn.to",
        "lookugly.com", "lopl.co.cc", "lortemail.dk", "lr78.com", "m4ilweb.info",
        "maboard.com", "mail-temporaire.fr", "mail.by", "mail.mezimages.net",
        "mail2rss.org", "mail333.com", "mail4trash.com", "mailbidon.com",
        "mailBlocks.com", "mailcatch.com", "maildrop.cc", "maileater.com",
        "mailexpire.com", "mailfa.tk", "mailforspam.com", "mailfreeonline.com",
        "mailfs.com", "mailguard.me", "mailimate.com", "mailin8r.com",
        "mailinater.com", "mailinator.com", "mailinator.net", "mailinator.org",
        "mailinator2.com", "mailincubator.com", "mailismagic.com", "mailjunk.cf",
        "mailmate.com", "mailme.ir", "mailme.lv", "mailmetrash.com", "mailmoat.com",
        "mailnator.com", "mailnesia.com", "mailnull.com", "mailPick.biz",
        "mailproxsy.com", "mailquack.com", "mailrock.biz", "mailsac.com",
        "mailscrap.com", "mailseal.de", "mailshell.com", "mailsiphon.com",
        "mailslapping.com", "mailslite.com", "mailtemp.info", "mailtothis.com",
        "mailzilla.com", "mailzilla.org", "makemetheking.com", "manifestgenerator.com",
        "mbx.cc", "mega.zik.dj", "meinspamschutz.de", "meltmail.com",
        "messagebeamer.de", "mezimages.net", "mintemail.com", "mjukglass.nu",
        "moakt.cc", "moakt.co", "moakt.com", "moakt.ws", "mohmal.com",
        "mohmal.im", "mohmal.in", "mohmal.tech", "moncourrier.fr.nf",
        "monemail.fr.nf", "monmail.fr.nf", "msa.minsmail.com", "mt2009.com",
        "mt2014.com", "mt2015.com", "mycleaninbox.net", "mypartyclip.de",
        "myphantomemail.com", "myspaceinc.com", "myspaceinc.net", "myspacepimpedup.com",
        "myspamless.com", "mytemp.email", "mytempemail.com", "mytrashmail.com",
        "nada.email", "nada.ltd", "neomailbox.com", "nepwk.com", "nervmich.net",
        "nervtmich.net", "netmails.com", "netmails.net", "netzidiot.de",
        "neverbox.com", "no-spam.ws", "nobulk.com", "noclickemail.com",
        "nogmailspam.info", "nomail.xl.cx", "nomail2me.com", "nomorespamemails.com",
        "nospam.ze.tc", "nospam4.us", "nospamfor.us", "nospamthanks.info",
        "notmailinator.com", "nowmymail.com", "nurfuerspam.de", "nus.edu.sg",
        "nwldx.com", "objectmail.com", "obobbo.com", "oneoffemail.com",
        "onewaymail.com", "online.ms", "oopi.org", "ordinaryamerican.net",
        "otherinbox.com", "ourklips.com", "outlawspam.com", "ovpn.to",
        "owlpic.com", "pancakemail.com", "pimpedupmyspace.com", "pjjkp.com",
        "plexolan.de", "poczta.onet.pl", "politikerclub.de", "poofy.org",
        "pookmail.com", "privacy.net", "proxymail.eu", "prtnx.com",
        "putthisinyourspamdatabase.com", "pwrby.com", "qq.com", "quickinbox.com",
        "rcpt.at", "reallymymail.com", "recode.me", "recursor.net",
        "regbypass.com", "regbypass.comsafe-mail.net", "rejectmail.com",
        "rhyta.com", "rklips.com", "rmqkr.net", "rppkn.com", "rtrtr.com",
        "s0ny.net", "safe-mail.net", "safersignup.de", "safetymail.info",
        "safetypost.de", "sandelf.de", "saynotospams.com", "selfdestructingmail.com",
        "sendspamhere.com", "sharklasers.com", "shieldedmail.com", "shiftmail.com",
        "shitmail.me", "shitmail.org", "shortmail.net", "sibmail.com",
        "skeefmail.com", "slaskpost.se", "slopsbox.com", "smellfear.com",
        "snakemail.com", "sneakemail.com", "sofimail.com", "sofort-mail.de",
        "sogetthis.com", "soodonims.com", "spam.la", "spam.su", "spam4.me",
        "spamavert.com", "spambob.com", "spambob.net", "spambob.org",
        "spambog.com", "spambog.de", "spambog.net", "spambog.ru", "spambox.info",
        "spambox.irishspringrealty.com", "spambox.us", "spamcannon.com",
        "spamcannon.net", "spamcero.com", "spamcon.org", "spamcorptastic.com",
        "spamcowboy.com", "spamcowboy.net", "spamcowboy.org", "spamday.com",
        "spamex.com", "spamfree.eu", "spamfree24.com", "spamfree24.de",
        "spamfree24.eu", "spamfree24.info", "spamfree24.net", "spamfree24.org",
        "spamgoes.in", "spamgourmet.com", "spamgourmet.net", "spamgourmet.org",
        "spamherelots.com", "spamhereplease.com", "spamhole.com", "spamify.com",
        "spaminator.de", "spamkill.info", "spaml.com", "spaml.de", "spammotel.com",
        "spamobox.com", "spamoff.de", "spamslicer.com", "spamspot.com",
        "spamstack.net", "spamthis.co.uk", "spamthisplease.com", "spamtrail.com",
        "spamtroll.net", "speed.1s.fr", "spoofmail.de", "stuffmail.de",
        "super-auswahl.de", "supergreatmail.com", "supermailer.jp", "superrito.com",
        "superstachel.de", "suremail.info", "talkinator.com", "teewars.org",
        "teleworm.com", "teleworm.us", "temp-mail.com", "temp-mail.de",
        "temp-mail.org", "temp-mail.ru", "tempail.com", "tempalias.com",
        "tempe-mail.com", "tempemail.biz", "tempemail.co.za", "tempemail.com",
        "tempemail.net", "tempinbox.co.uk", "tempinbox.com", "tempmail.co",
        "tempmail.de", "tempmail.eu", "tempmail.it", "tempmail.net",
        "tempmail.org", "tempmail.us", "tempmail2.com", "tempmaildemo.com",
        "tempmailer.com", "tempmailer.de", "tempmailo.com", "tempomail.fr",
        "temporarily.de", "temporarioemail.com.br", "temporaryemail.net",
        "temporaryemail.us", "temporaryforwarding.com", "temporaryinbox.com",
        "temporarymailaddress.com", "tempthe.net", "thankyou2010.com",
        "thisisnotmyrealemail.com", "throwam.com", "throwawayemailaddress.com",
        "throwawaymail.com", "tilien.com", "tittbit.in", "tmailinator.com",
        "toiea.com", "toomail.biz", "tradermail.info", "trash-amil.com",
        "trash-mail.at", "trash-mail.com", "trash-mail.de", "trash2009.com",
        "trash2010.com", "trash2011.com", "trashcanmail.com", "trashdevil.com",
        "trashdevil.de", "trashemail.de", "trashmail.at", "trashmail.com",
        "trashmail.de", "trashmail.me", "trashmail.net", "trashmail.org",
        "trashmail.ws", "trashmailer.com", "trashymail.com", "trashymail.net",
        "trbvm.com", "trialmail.de", "trickmail.net", "trillianpro.com",
        "tryalert.com", "turual.com", "twinmail.de", "tyldd.com", "uggsrock.com",
        "umail.net", "upliftnow.com", "uplipht.com", "uroid.com", "us.af",
        "venompen.com", "veryrealemail.com", "viditag.com", "viewcastmedia.com",
        "viewcastmedia.net", "viewcastmedia.org", "webm4il.info", "wegwerfadresse.de",
        "wegwerfemail.com", "wegwerfemail.de", "wegwerfmail.de", "wegwerfmail.info",
        "wegwerfmail.net", "wegwerfmail.org", "wetrainbayarea.com", "wetrainbayarea.org",
        "wh4f.org", "whatiaas.com", "whatpaas.com", "whyspam.me", "willhackforfood.biz",
        "willselfdestruct.com", "winemaven.info", "wronghead.com", "wuzup.net",
        "wuzupmail.net", "wwwnew.eu", "xagloo.com", "xemaps.com", "xents.com",
        "xmaily.com", "xoxy.net", "yep.it", "yogamaven.com", "yopmail.com",
        "yopmail.fr", "yopmail.net", "yourdomain.com", "ypmail.webarnak.fr.eu.org",
        "yuurok.com", "zehnminuten.de", "zehnminutenmail.de", "zippymail.info",
        "zoaxe.com", "zoemail.com", "zoemail.net", "zoemail.org"
    };

    /// <summary>
    /// Returns true if the email address belongs to a known disposable or temporary email provider.
    /// Checks both the exact domain and any parent domains (e.g. sub.mailinator.com).
    /// </summary>
    public static bool IsDisposableEmail(string? email)
    {
        var normalized = NormalizeEmail(email);
        var atIndex = normalized.LastIndexOf('@');
        if (atIndex < 0 || atIndex >= normalized.Length - 1)
        {
            return false;
        }

        var domain = normalized[(atIndex + 1)..].Trim('.');
        if (string.IsNullOrWhiteSpace(domain))
        {
            return false;
        }

        while (!string.IsNullOrEmpty(domain))
        {
            if (DisposableDomains.Contains(domain))
            {
                return true;
            }

            var dotIndex = domain.IndexOf('.');
            if (dotIndex < 0)
            {
                break;
            }

            domain = domain[(dotIndex + 1)..];
        }

        return false;
    }
}
