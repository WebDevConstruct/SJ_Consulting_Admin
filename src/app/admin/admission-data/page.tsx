import AdmissionDataPage from "@/components/admin/admission-data/AdmissionDataPage";

export const metadata = {
  title: "Admission Data | SJ Consulting Admin",
  description:
    "Upload, extract, review, and publish university admission requirements and merit/catchment cut-off data.",
};

export default function Page() {
  return <AdmissionDataPage />;
}