import {createClient} from "@lib/supabase/server"
import { NextResponse } from "next/server";

export async  function POST(request : Request){
    const {email, password} : {email : string, password : string}
     = await request.json();


     const supabase = createClient();
const {data : admin, error : adminError} = await (await supabase).from("admin_access")
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

     const {data, error} = await (await supabase).auth.signInWithPassword({
        email,
        password
     })

     if(!email){
        return NextResponse?.json({
            error : "Enter a valid Email address"
        }, {
            status : 400
        })
     }

     
     if(!data || error){
        return NextResponse.json({
            error : "Could not resolve your account"
        }, {status : 404})
     }
     return NextResponse.json({
         success : "Sign in Successful"
     }, {status : 200})
}