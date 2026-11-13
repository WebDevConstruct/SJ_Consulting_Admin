import {NextResponse} from "next/server";
import {createClient} from "@lib/supabase/server";


export async function POST(request : Request){
    const body = await request.json();
    const email = String(body?.email ?? "")?.trim()?.toLowerCase();
    
    if(!email){
        return NextResponse.json({
            error : "Email is required"
        }, {status : 400})
    };

    const supabase = await createClient();
    const {data : admin, error : adminError} = await supabase.from("admin_access")
.select("email, role, is_active")
.eq("email", email)
.eq("is_active", true)
console.log(admin)

if(adminError){
    return NextResponse.json({error : "Unable to verify Admin access."},
        {status : 500});
    }

    if(!admin){
        console.log(admin);
        return  NextResponse.json({
            error : "Unauthorized Email"
        }, {
            status : 403
        })
    }
    const {error} = await supabase.auth.signInWithOtp({
        email, options : {
            shouldCreateUser : false
        }
    });
    if(error){
        if (error) {
  console.error("Supabase OTP error:", {
    name: error.name,
    message: error.message,
    status: error.status,
  });
        }
        return NextResponse.json({
            error : "Unable to signIn to your account, Please try again later."
        }, {
            status : 500
        })
    }
    return NextResponse.json({
         success : "Verification Code has been sent to your email"
    }, {
        status : 200
    })
}