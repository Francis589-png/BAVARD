
import ProfilePage from "@/components/profile-page";

export default function UserProfile({ params }: { params: { userId: string } }) {
  return <ProfilePage userId={params.userId} />;
}
