import {NextResponse} from "next/server";
import {createClient} from "@lib/supabase/server";

export async function POST(request : Request){
    const body = await request.json();
    const email = String(body?.email ?? "")?.trim()?.toLowerCase();
    const token = String(body?.to0ken ?? "")?.trim();
    if(!email || !/^\d{6}$/.test(token)){
        return NextResponse.json({
            error : "Enter a valid 6 digits verification code"
        }, {status : 400})
    }
const supabase = await createClient();

const {data, error} = await supabase?.auth?.verifyOtp({
 email,
 token,
 type : "email"
})
if(error || !data?.user){
    return NextResponse.json({
          error : "The Verification Code is Invalid or has expired"
    }, {status : 401})
}

const {data : admin, error : adminError} = await supabase.from("admin_access")
.select("id, email, role, is_active")
.eq("email", data?.user?.email?.toLowerCase())
.eq("is_active", true)
.maybeSingle();

if(adminError || !admin){
    await supabase.auth?.signOut();

    return NextResponse.json({
        error : "This account is noy authorized for admin access"
    }, {status : 403})
}
return NextResponse.json({
    success : true,
    redirectTo : "/admin/home",
    admin
})
}