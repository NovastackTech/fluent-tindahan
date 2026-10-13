To make the POS system you built BIR-accredited in the Philippines, you need to go through **Supplier Accreditation**. The Bureau of Internal Revenue (BIR) requires the software provider to have their system evaluated and certified by the National Office before any merchant can use it to issue official receipts.

Here is the step-by-step process for accrediting your POS software as a developer, along with the strict technical requirements your system must meet.

### Phase 1: Ensure Your POS Meets BIR Technical Standards

Before applying, the BIR’s Computerized System Evaluation Team (CSET) will scrutinize your system. If it lacks any of these mandated features, the application will be rejected:

* **Non-Resettable Grand Total:** The system must maintain an accumulating grand total of all sales (at least 10 digits) that cannot be reset or altered by the user or admin.
* **Z-Reading and X-Reading:** It must be able to generate daily end-of-day sales reports (Z-Reading) that lock the day's total, and shift reports (X-Reading).
* **Audit Trail & e-Journal:** Sales data must be preserved in a non-volatile memory or secure backup. The electronic journal of all transactions must be unalterable.
* **Statutory Philippine Discounts:** Your POS must natively calculate and deduct mandated discounts accurately (Senior Citizen, PWD, Solo Parent, Medal of Valor).
* **VAT Handling:** It must be able to segregate and compute VATable, VAT-exempt, and Zero-rated sales.
* **Receipt Footer Requirements:** Your system-generated receipts must automatically print the following at the bottom: Your company name, address, TIN, BIR Accreditation Number, Date Issued, Valid Until date, and a space for the client's Permit to Use (PTU) number and Machine Identification Number (MIN).

### Phase 2: The Accreditation Process

According to BIR regulations (such as RMO 24-2023), the application for accreditation itself is free of charge from the BIR.

**1. Enroll as a Supplier in the eAccReg System**
You cannot apply offline. You must first enroll your software development business in the BIR’s Enhanced Electronic Accreditation and Registration (eAccReg) system. You will need to submit a Sworn Declaration to the Revenue District Office (RDO) where your business is registered to activate your eAccReg account.

**2. Submit Documentary Requirements**
Once enrolled, you will apply for accreditation for your specific software version through the portal. You must prepare and submit a comprehensive technical dossier, which typically includes:

* **Company Profile:** Photocopy of your BIR Certificate of Registration (Form 2303) and SEC/DTI registration.
* **System Documentation:** Detailed blueprints including the system flow, process flow, database architecture, backup procedures, and disaster recovery plan.
* **Sworn Statement:** A notarized document proving you are the owner/developer of the software.
* **Sample Outputs:** Facsimiles (sample printouts) of the system-generated receipts, Z-Readings, X-Readings, and any other generated reports.

**3. The System Demonstration (CSET Evaluation)**
After reviewing your documents, the BIR will schedule a system demonstration. You will present the POS to the CSET to prove that it functions exactly as documented, correctly computes Philippine taxes and discounts, and cannot be easily tampered with to hide sales.

**4. Receive Your Certificate of Accreditation**
If your system passes the evaluation, the BIR National Office will issue a Certificate of Accreditation. This certificate is tied to your exact software version. You will be given an **Accreditation Number** and a **Validity Date** (which typically expires and requires renewal).

### Phase 3: Client Deployment (Permit to Use)

Once you hold the Accreditation Certificate, you can start selling the POS. However, your clients cannot just plug it in and use it.

* For every new client (and every new branch they open), the client must log into their own eAccReg account and register the specific machine.
* They will select your accredited software from the BIR database.
* The client's RDO will then issue them a **Permit to Use (PTU)** and a **Machine Identification Number (MIN)**.
* You must configure the software on their machine to print their new PTU and MIN on the receipts.

**Important Note on Updates:** Because your accreditation is tied to a specific version, pushing major software updates, bug fixes that alter the database, or new features usually requires you to apply for a system enhancement/modification approval with the BIR.
**Important Note on Updates:** Because your accreditation is tied to a specific version, pushing major software updates, bug fixes that alter the database, or new features usually requires you to apply for a system enhancement/modification approval with the BIR.