-- CreateEnum
CREATE TYPE "StudentRegistrationConsentType" AS ENUM ('Contact', 'EmergencyMedical', 'LocalActivities', 'PhotoVideo', 'Accuracy');

-- CreateTable
CREATE TABLE "ParentRegistration" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "homeAddressEnc" TEXT NOT NULL,
    "agreementNameEnc" TEXT NOT NULL,
    "agreementDate" DATE NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationGuardianContact" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "fullNameEnc" TEXT NOT NULL,
    "relationshipEnc" TEXT NOT NULL,
    "primaryPhoneEnc" TEXT NOT NULL,
    "secondaryPhoneEnc" TEXT,
    "emailEnc" TEXT,
    "workPhoneEnc" TEXT,
    "addressEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationGuardianContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationEmergencyContact" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "fullNameEnc" TEXT NOT NULL,
    "relationshipEnc" TEXT NOT NULL,
    "primaryPhoneEnc" TEXT NOT NULL,
    "secondaryPhoneEnc" TEXT,
    "emailEnc" TEXT,
    "canPickUp" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationPickupContact" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "fullNameEnc" TEXT NOT NULL,
    "relationshipEnc" TEXT NOT NULL,
    "phoneEnc" TEXT NOT NULL,
    "idPasswordNoteEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationPickupContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRegistrationProfile" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "preferredNameEnc" TEXT,
    "genderEnc" TEXT,
    "homeLanguageEnc" TEXT,
    "studentNotesEnc" TEXT,
    "allergiesEnc" TEXT,
    "medicalConditionsEnc" TEXT,
    "medicationAtCentreEnc" TEXT,
    "dietaryRestrictionsEnc" TEXT,
    "learningSupportEnc" TEXT,
    "interestsStrengthsEnc" TEXT,
    "settlingComfortNotesEnc" TEXT,
    "additionalInfoEnc" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentRegistrationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentRegistrationConsent" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "consentType" "StudentRegistrationConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "initialsEnc" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentRegistrationConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ParentRegistration_parentUserId_key" ON "ParentRegistration"("parentUserId");

-- CreateIndex
CREATE INDEX "ParentRegistration_submittedAt_idx" ON "ParentRegistration"("submittedAt");

-- CreateIndex
CREATE INDEX "RegistrationGuardianContact_registrationId_idx" ON "RegistrationGuardianContact"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationGuardianContact_registrationId_position_key" ON "RegistrationGuardianContact"("registrationId", "position");

-- CreateIndex
CREATE INDEX "RegistrationEmergencyContact_registrationId_idx" ON "RegistrationEmergencyContact"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationEmergencyContact_registrationId_position_key" ON "RegistrationEmergencyContact"("registrationId", "position");

-- CreateIndex
CREATE INDEX "RegistrationPickupContact_registrationId_idx" ON "RegistrationPickupContact"("registrationId");

-- CreateIndex
CREATE UNIQUE INDEX "RegistrationPickupContact_registrationId_position_key" ON "RegistrationPickupContact"("registrationId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRegistrationProfile_studentId_key" ON "StudentRegistrationProfile"("studentId");

-- CreateIndex
CREATE INDEX "StudentRegistrationProfile_registrationId_idx" ON "StudentRegistrationProfile"("registrationId");

-- CreateIndex
CREATE INDEX "StudentRegistrationConsent_profileId_idx" ON "StudentRegistrationConsent"("profileId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentRegistrationConsent_profileId_consentType_key" ON "StudentRegistrationConsent"("profileId", "consentType");

-- AddForeignKey
ALTER TABLE "ParentRegistration" ADD CONSTRAINT "ParentRegistration_parentUserId_fkey" FOREIGN KEY ("parentUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationGuardianContact" ADD CONSTRAINT "RegistrationGuardianContact_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ParentRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationEmergencyContact" ADD CONSTRAINT "RegistrationEmergencyContact_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ParentRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationPickupContact" ADD CONSTRAINT "RegistrationPickupContact_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ParentRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRegistrationProfile" ADD CONSTRAINT "StudentRegistrationProfile_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "ParentRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRegistrationProfile" ADD CONSTRAINT "StudentRegistrationProfile_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentRegistrationConsent" ADD CONSTRAINT "StudentRegistrationConsent_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "StudentRegistrationProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
